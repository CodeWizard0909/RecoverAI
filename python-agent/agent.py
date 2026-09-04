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

# =========================================================================
# AGENT TOOLS (Callable by Gemini)
# =========================================================================

def get_customer_context(email: str) -> dict:
    """Queries the CRM/Database for customer history like LTV and prior failures."""
    # Mocking CRM lookup for buildathon
    return {
        "lifetime_value": 120000,
        "previous_failures_this_year": 2,
        "is_vip": True if "vip" in email.lower() else False
    }

def escalate_payment(payment_id: str, reason: str, churn_risk: int) -> str:
    """Escalates a failed payment to a human operator via Slack."""
    try:
        res = supabase.table('failed_payments').select('*').eq('id', payment_id).single().execute()
        payment = res.data
        
        slack_payload = {
            "text": f"🚨 VIP Payment Failed: ₹{payment['amount']/100}",
            "blocks": [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*VIP Payment Failed*\n*Amount:* ₹{payment['amount']/100}\n*AI Reasoning:* {reason}"}
                }
            ]
        }
        print("\n" + "="*50)
        print("🚀 [SLACK WEBHOOK FIRED] Human-in-the-loop requested!")
        print(json.dumps(slack_payload, indent=2))
        print("="*50 + "\n")

        action_reasoning = f"[CHURN_RISK: {churn_risk}%] {reason}"
        
        supabase.table('recovery_actions').insert({
            'payment_id': payment_id,
            'type': 'escalate',
            'status': 'escalated_to_slack',
            'gemini_reasoning': action_reasoning,
            'executed_at': datetime.now(timezone.utc).isoformat()
        }).execute()
        
        supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', payment_id).execute()
        
        return "Successfully escalated to Slack."
    except Exception as e:
        return f"Error escalating: {str(e)}"

def generate_recovery_link(payment_id: str, offer_partial: bool, reason: str, churn_risk: int) -> str:
    """Generates a Razorpay payment link for the customer to retry their payment."""
    try:
        res = supabase.table('failed_payments').select('*').eq('id', payment_id).single().execute()
        payment = res.data
        
        action_id = f"act_{int(datetime.now().timestamp())}" # Generate deterministic ID for notes
        
        link_req = {
            "amount": payment['amount'],
            "currency": payment['currency'] or 'INR',
            "accept_partial": False,
            "description": f"Recovery for failed transaction {payment.get('razorpay_payment_id')}",
            "customer": {
                "email": payment.get('customer_email') or "demo@example.com",
                "contact": payment.get('customer_phone') or "+919876543210"
            },
            "notify": {"sms": False, "email": False},
            "notes": {
                "original_payment_id": payment.get('razorpay_payment_id'),
                "recovery_action_id": action_id
            }
        }
        
        plink = rzp_client.payment_link.create(link_req)
        
        tags = f"[CHURN_RISK: {churn_risk}%]"
        if offer_partial:
            tags += " [BARGAINING_ACTIVE]"
            
        reasoning = f"{tags} {reason} | LINK: {plink.get('short_url', '')}"
        
        if offer_partial:
            partial_req = dict(link_req)
            partial_req["amount"] = int(payment['amount'] / 2)
            partial_req["description"] = f"Partial 50% Recovery Plan for {payment.get('razorpay_payment_id')}"
            partial_plink = rzp_client.payment_link.create(partial_req)
            reasoning += f" | PARTIAL_LINK: {partial_plink.get('short_url', '')}"
            
        supabase.table('recovery_actions').insert({
            'id': action_id,
            'payment_id': payment_id,
            'type': 'send_link' if offer_partial else 'retry_upi',
            'status': 'executed',
            'gemini_reasoning': reasoning,
            'executed_at': datetime.now(timezone.utc).isoformat()
        }).execute()
        
        supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', payment_id).execute()
        
        return "Successfully generated recovery link."
    except Exception as e:
        return f"Error generating link: {str(e)}"


# =========================================================================
# AGENT ORCHESTRATOR
# =========================================================================

tools = [get_customer_context, escalate_payment, generate_recovery_link]

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
                # Guard against duplicates
                existing = supabase.table('recovery_actions').select('id', count='exact').eq('payment_id', payment['id']).execute()
                if existing.count and existing.count > 0:
                    supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', payment['id']).execute()
                    continue

                logger.info(f"🤖 [Agent] Starting recovery for payment {payment['id']}")
                
                system_instruction = f"""
                You are an autonomous Revenue Recovery Agent.
                A payment failed for ID: {payment['id']}
                Amount: ₹{payment.get('amount', 0) / 100}
                Reason: {payment.get('failure_reason')}
                Email: {payment.get('customer_email', 'unknown')}

                Your Goal: Recover the revenue.
                Rules:
                1. Always call get_customer_context first to learn about the user.
                2. If amount > ₹50,000 OR they are a VIP, call escalate_payment.
                3. Otherwise, call generate_recovery_link.
                4. If churn risk > 70%, pass offer_partial=True to generate_recovery_link.
                """
                
                chat = ai_client.chats.create(
                    model='gemini-2.5-flash',
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        tools=tools
                    )
                )
                
                # Turn 1: Give context
                response = chat.send_message(system_instruction)
                
                # Simple loop to execute tool calls requested by the model
                max_turns = 3
                for _ in range(max_turns):
                    if not response.function_calls:
                        break # Done
                        
                    for fn in response.function_calls:
                        logger.info(f"🛠️ [Agent] Executing tool: {fn.name}")
                        
                        if fn.name == 'get_customer_context':
                            result = get_customer_context(**fn.args)
                        elif fn.name == 'escalate_payment':
                            result = escalate_payment(**fn.args)
                        elif fn.name == 'generate_recovery_link':
                            result = generate_recovery_link(**fn.args)
                        else:
                            result = f"Error: Unknown function {fn.name}"
                            
                        # Send result back to model
                        response = chat.send_message(
                            types.Part.from_function_response(
                                name=fn.name,
                                response={"result": result}
                            )
                        )
                
                success_count += 1
            except Exception as e:
                logger.error(f"[Agent] Failed to process payment {payment['id']}: {e}")
                
        return success_count
    except Exception as e:
        logger.error(f"[Brain] Database fetch error: {e}")
        return 0

# (Removed execute_recovery_actions because the Agent executes immediately via Tools)
def execute_recovery_actions():
    return 0
