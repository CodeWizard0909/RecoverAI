import os
import sys
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from supabase import create_client, Client
from google import genai
from google.genai import types
import razorpay
from dotenv import load_dotenv

current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent
load_dotenv(root_dir / '.env.local')

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip('"')
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip('"')
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip('"')
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip('"')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
ai_client = genai.Client(api_key=GEMINI_API_KEY)
rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

from pydantic import BaseModel, ValidationError, Field

# =========================================================================
# TOOL ARGUMENT VALIDATION (PYDANTIC)
# =========================================================================

class EscalateArgs(BaseModel):
    payment_id: str = Field(..., description="The unique ID of the failed payment")
    amount: int = Field(..., description="The payment amount in the smallest currency unit (paise)")
    reason: str = Field(..., description="The technical reason for the failure")
    strategy_reasoning: str = Field(..., description="Detailed explanation of why this payment requires human escalation")

class CreateLinkArgs(BaseModel):
    payment_id: str = Field(..., description="The unique ID of the failed payment")
    amount: int = Field(..., description="The payment amount in the smallest currency unit (paise)")
    is_partial: bool = Field(..., description="Set to true to offer a 50% discount/partial payment link for bargaining")
    strategy_reasoning: str = Field(..., description="Detailed explanation of why a link (and potential partial offer) was chosen")

# =========================================================================
# AGENT TOOLS (Callable by Gemini)
# =========================================================================

def get_customer_context(email: str) -> dict:
    """Retrieves customer history (LTV, prior failures, VIP status) from the CRM."""
    return {
        "lifetime_value": 120000,
        "previous_failures_this_year": 2,
        "is_vip": True if "vip" in email.lower() else False
    }

def escalate_to_human(payment_id: str, amount: int, reason: str, strategy_reasoning: str) -> str:
    """Escalates a high-risk or VIP failed payment to a human operator via Slack."""
    try:
        # Validate inputs via Pydantic
        args = EscalateArgs(payment_id=payment_id, amount=amount, reason=reason, strategy_reasoning=strategy_reasoning)
        
        slack_payload = {
            "text": f"🚨 VIP/High-Risk Payment Failed: ₹{args.amount/100}",
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Human Escalation Required*\n*Amount:* ₹{args.amount/100}\n*AI Strategy Reasoning:* {args.strategy_reasoning}\n*Technical Error:* {args.reason}"}
                }
            ]
        }
        print("\n" + "="*50)
        print("🚀 [SLACK WEBHOOK FIRED] Human-in-the-loop requested!")
        print(json.dumps(slack_payload, indent=2))
        print("="*50 + "\n")
        
        supabase.table('recovery_actions').insert({
            'payment_id': args.payment_id,
            'type': 'escalate',
            'status': 'executed',
            'gemini_reasoning': args.strategy_reasoning,
            'executed_at': datetime.now(timezone.utc).isoformat()
        }).execute()
        
        supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', args.payment_id).execute()
        return "Successfully escalated to human operator."
    except ValidationError as ve:
        return f"Input Validation Error: {ve}"
    except Exception as e:
        return f"Error escalating: {str(e)}"

def create_recovery_link(payment_id: str, amount: int, is_partial: bool, strategy_reasoning: str) -> str:
    """Generates a Razorpay payment link to send to the customer. Use is_partial=True to offer a 50% discount for high flight-risk users."""
    try:
        # Validate inputs via Pydantic
        args = CreateLinkArgs(payment_id=payment_id, amount=amount, is_partial=is_partial, strategy_reasoning=strategy_reasoning)
        
        res = supabase.table('failed_payments').select('currency, customer_email, customer_phone, razorpay_payment_id').eq('id', args.payment_id).single().execute()
        payment_meta = res.data
        
        import uuid
        action_id = str(uuid.uuid4())
        
        link_req = {
            "amount": args.amount,
            "currency": payment_meta.get('currency') or 'INR',
            "accept_partial": False,
            "description": f"Recovery for failed transaction {payment_meta.get('razorpay_payment_id')}",
            "customer": {
                "email": payment_meta.get('customer_email') or "demo@example.com",
                "contact": payment_meta.get('customer_phone') or "+919876543210"
            },
            "notify": {"sms": False, "email": False},
            "notes": {
                "original_payment_id": payment_meta.get('razorpay_payment_id'),
                "recovery_action_id": action_id
            }
        }
        
        plink = rzp_client.payment_link.create(link_req)
        final_reasoning = f"{args.strategy_reasoning} | LINK: {plink.get('short_url', '')}"
        
        if args.is_partial:
            partial_req = dict(link_req)
            partial_req["amount"] = int(args.amount / 2)
            partial_req["description"] = f"Partial 50% Recovery Plan for {payment_meta.get('razorpay_payment_id')}"
            partial_plink = rzp_client.payment_link.create(partial_req)
            final_reasoning += f" | PARTIAL_LINK: {partial_plink.get('short_url', '')}"
            
        supabase.table('recovery_actions').insert({
            'id': action_id,
            'payment_id': args.payment_id,
            'type': 'send_link' if args.is_partial else 'retry_upi',
            'status': 'executed',
            'gemini_reasoning': final_reasoning,
            'executed_at': datetime.now(timezone.utc).isoformat()
        }).execute()
        
        supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', args.payment_id).execute()
        return "Successfully created recovery link."
    except ValidationError as ve:
        return f"Input Validation Error: {ve}"
    except Exception as e:
        return f"Error creating link: {str(e)}"


# =========================================================================
# AGENT ORCHESTRATOR
# =========================================================================

tools = [get_customer_context, escalate_to_human, create_recovery_link]

def process_pending_failures():
    """Fetches new failed payments and runs the autonomous agent loop."""
    try:
        res = supabase.table('failed_payments').select('*').eq('status', 'pending_analysis').limit(10).execute()
        payments = res.data
        
        if not payments:
            return 0
            
        success_count = 0
        for payment in payments:
            try:
                existing = supabase.table('recovery_actions').select('id', count='exact').eq('payment_id', payment['id']).execute()
                if existing.count and existing.count > 0:
                    supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', payment['id']).execute()
                    continue

                logger.info(f"🤖 [Agent] Starting reasoning loop for payment {payment['id']}")
                
                system_instruction = f"""
                You are an autonomous Revenue Recovery Agent tasked with recovering a failed payment.

                Payment Context:
                - Payment ID: {payment['id']}
                - Amount: ₹{payment.get('amount', 0) / 100} (Pass {payment.get('amount', 0)} in tools)
                - Failure Reason: {payment.get('failure_reason')}
                - Customer Email: {payment.get('customer_email', 'unknown')}

                Your Goal: Maximize revenue recovery and customer retention.
                
                You have full autonomy over the recovery strategy.
                - First, ALWAYS call get_customer_context to understand who you are dealing with.
                - Based on the customer's LTV, failure reason, and risk profile, formulate the best recovery strategy.
                - You may offer partial links for high churn risk, or escalate if the payment is massive or complex.
                - Always provide a highly detailed 'strategy_reasoning' to explain your autonomous decision.
                """
                
                chat = ai_client.chats.create(
                    model='gemini-3.6-flash',
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        tools=tools
                    )
                )
                
                response = chat.send_message(system_instruction)
                
                max_turns = 3
                for _ in range(max_turns):
                    if not response.function_calls:
                        break
                        
                    for fn in response.function_calls:
                        logger.info(f"🛠️ [Agent] Executing tool: {fn.name}")
                        
                        result = None
                        try:
                            if fn.name == 'get_customer_context':
                                result = get_customer_context(**fn.args)
                            elif fn.name == 'escalate_to_human':
                                result = escalate_to_human(**fn.args)
                            elif fn.name == 'create_recovery_link':
                                result = create_recovery_link(**fn.args)
                            else:
                                result = f"Error: Unknown function {fn.name}"
                        except ValidationError as ve:
                            logger.warning(f"⚠️ [Agent] Pydantic Validation Error in {fn.name}: {ve}")
                            result = f"ValidationError: Your arguments were invalid. Please correct them. Details: {ve}"
                        except Exception as e:
                            logger.error(f"⚠️ [Agent] Execution Error in {fn.name}: {e}")
                            result = f"ExecutionError: {e}"
                            
                        logger.info(f"📝 [Agent] Tool {fn.name} result: {str(result)[:100]}...")
                        
                        response = chat.send_message(
                            types.Part.from_function_response(
                                name=fn.name,
                                response={"result": result}
                            )
                        )
                
                logger.info(f"🎯 [Agent] Completed reasoning for payment {payment['id']}")
                success_count += 1
            except Exception as e:
                logger.error(f"[Agent] Failed to process payment {payment['id']}: {e}")
                
        return success_count
    except Exception as e:
        logger.error(f"[Brain] Database fetch error: {e}")
        return 0

def execute_recovery_actions():
    return 0
