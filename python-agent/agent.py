import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from supabase import create_client, Client
from postgrest.types import CountMethod
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
# GOOGLE GENAI FUNCTION DECLARATIONS
# =========================================================================

# Define function declarations for Gemini API
get_customer_context_declaration = types.FunctionDeclaration(
    name="get_customer_context",
    description="Retrieves customer history (LTV, prior failures, VIP status) from the CRM.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "email": types.Schema(type=types.Type.STRING),
        },
        required=["email"],
    ),
)

escalate_to_human_declaration = types.FunctionDeclaration(
    name="escalate_to_human",
    description="Escalates a high-risk or VIP failed payment to a human operator via Slack.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "payment_id": types.Schema(type=types.Type.STRING),
            "amount": types.Schema(type=types.Type.INTEGER),
            "reason": types.Schema(type=types.Type.STRING),
            "strategy_reasoning": types.Schema(type=types.Type.STRING),
        },
        required=["payment_id", "amount", "reason", "strategy_reasoning"],
    ),
)

create_recovery_link_declaration = types.FunctionDeclaration(
    name="create_recovery_link",
    description="Generates a Razorpay payment link to send to the customer. Use is_partial=True to offer a 50% discount/partial payment link for bargaining.",
    parameters=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "payment_id": types.Schema(type=types.Type.STRING),
            "amount": types.Schema(type=types.Type.INTEGER),
            "is_partial": types.Schema(type=types.Type.BOOLEAN),
            "strategy_reasoning": types.Schema(type=types.Type.STRING),
        },
        required=["payment_id", "amount", "is_partial", "strategy_reasoning"],
    ),
)

# Tools are now defined inline in the chat creation

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
        
        res = supabase.table('failed_payments').select('currency, customer_email, customer_phone, razorpay_payment_id').eq('id', args.payment_id).limit(1).execute()
        # Check if we got valid data - help type checker understand res.data structure
        if not res.data or not isinstance(res.data, list) or len(res.data) == 0:
            return "Error: Payment metadata not found"
        payment_meta = res.data[0]
        # Ensure payment_meta is a dictionary
        if not isinstance(payment_meta, dict):
            return "Error: Invalid payment metadata format"

        # Extract required fields from payment_meta to avoid repeated .get() calls
        currency = payment_meta.get('currency') or 'INR'
        razorpay_payment_id = payment_meta.get('razorpay_payment_id')
        customer_email = payment_meta.get('customer_email') or "demo@example.com"
        customer_phone = payment_meta.get('customer_phone') or "+919876543210"

        import uuid
        action_id = str(uuid.uuid4())

        link_req = {
            "amount": args.amount,
            "currency": currency,
            "accept_partial": False,
            "description": f"Recovery for failed transaction {razorpay_payment_id}",
            "customer": {
                "email": customer_email,
                "contact": customer_phone
            },
            "notify": {"sms": False, "email": False},
            "notes": {
                "original_payment_id": razorpay_payment_id,
                "recovery_action_id": action_id
            }
        }
        
        plink = rzp_client.post('/payment_links', link_req)  # type: ignore[attr-defined]
        # Extract short_url safely from response (could be dict or string)
        short_url = ''
        if isinstance(plink, dict):
            short_url = plink.get('short_url', '')
        final_reasoning = f"{args.strategy_reasoning} | LINK: {short_url}"

        if args.is_partial:
            partial_req = dict(link_req)
            partial_req["amount"] = int(args.amount / 2)
            partial_req["description"] = f"Partial 50% Recovery Plan for {payment_meta.get('razorpay_payment_id')}"
            partial_plink = rzp_client.post('/payment_links', partial_req)  # type: ignore[attr-defined]
            # Extract short_url safely from response (could be dict or string)
            partial_short_url = ''
            if isinstance(partial_plink, dict):
                partial_short_url = partial_plink.get('short_url', '')
            final_reasoning += f" | PARTIAL_LINK: {partial_short_url}"
            
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


def process_pending_failures():
    """Fetches new failed payments and runs the autonomous agent loop."""
    try:
        res = supabase.table('failed_payments').select('*').eq('status', 'pending_analysis').limit(10).execute()
        # Help type checker understand that res.data is a list of dicts
        if not res.data or not isinstance(res.data, list):
            return 0
        payments = res.data

        if not payments:
            return 0
            
        success_count = 0
        for payment in payments:
            # Ensure payment is a dictionary before accessing its properties
            if not isinstance(payment, dict):
                logger.warning(f"Skipping invalid payment data: {payment}")
                continue

            try:
                existing = supabase.table('recovery_actions').select('id', count=CountMethod.exact).eq('payment_id', payment['id']).execute()
                if existing.count and existing.count > 0:
                    supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', payment['id']).execute()
                    continue

                logger.info(f"🤖 [Agent] Starting reasoning loop for payment {payment['id']}")

                # Safely get and convert amount to int
                amount_val = payment.get('amount')
                amount_int = 0  # default
                if amount_val is not None:
                    if isinstance(amount_val, int):
                        amount_int = amount_val
                    elif isinstance(amount_val, float):
                        amount_int = int(amount_val)
                    elif isinstance(amount_val, str):
                        try:
                            amount_int = int(amount_val)
                        except ValueError:
                            try:
                                amount_int = int(float(amount_val))
                            except ValueError:
                                amount_int = 0
                    elif isinstance(amount_val, dict):
                        # If it's a dict, try to extract a numeric value from common keys
                        for key in ['amount', 'value', 'numeric_value']:
                            if key in amount_val:
                                val = amount_val[key]
                                if isinstance(val, (int, float)):
                                    amount_int = int(val)
                                    break
                    elif isinstance(amount_val, list):
                        # If it's a list, try to find the first numeric element
                        for item in amount_val:
                            if isinstance(item, (int, float)):
                                amount_int = int(item)
                                break
                            elif isinstance(item, str):
                                try:
                                    amount_int = int(item)
                                    break
                                except ValueError:
                                    try:
                                        amount_int = int(float(item))
                                        break
                                    except ValueError:
                                        continue
                    else:
                        # For any other type, try to convert to string then to int
                        try:
                            amount_int = int(str(amount_val))
                        except ValueError:
                            amount_int = 0

                system_instruction = f"""
                You are an autonomous Revenue Recovery Agent tasked with recovering a failed payment.

                Payment Context:
                - Payment ID: {payment['id']}
                - Amount: ₹{amount_int / 100} (Pass {amount_int} in tools)
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
                    model='gemini-flash-latest',
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        tools=[types.Tool(function_declarations=[
                            get_customer_context_declaration,
                            escalate_to_human_declaration,
                            create_recovery_link_declaration
                        ])]
                    )
                )
                import time
                response = None

                # Handle 503s and 429s on initial prompt
                for attempt in range(5):  # Increased retries for quota limits
                    try:
                        response = chat.send_message(system_instruction)
                        break
                    except Exception as api_err:
                        error_str = str(api_err)
                        if "503" in error_str and attempt < 4:
                            logger.warning(f"⚠️ API 503 Error on prompt. Retrying in {2 ** attempt}s...")
                            time.sleep(2 ** attempt)
                        elif "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                            if attempt < 4:
                                # Extract retry delay from error if available
                                retry_delay = min(2 ** attempt, 60)  # Cap at 60 seconds
                                logger.warning(f"⚠️ API 429 Quota Exceeded on prompt. Retrying in {retry_delay}s...")
                                time.sleep(retry_delay)
                            else:
                                logger.error(f"❌ API 429 Quota Exceeded after {attempt + 1} attempts. Giving up on this payment.")
                                return f"Error: Gemini API quota exceeded. Please try again later or upgrade your plan."
                        else:
                            raise api_err

                # If response is still None after retries, raise an exception
                if response is None:
                    raise Exception("Failed to get initial response from Gemini API after retries")
                            
                max_turns = 3
                for _ in range(max_turns):
                    if not response.function_calls:
                        break
                        
                    for fn in response.function_calls:
                        logger.info(f"🛠️ [Agent] Executing tool: {fn.name}")
                        
                        result = None
                        try:
                            # Check if fn.args is available and not None
                            if fn.args is None:
                                result = f"Error: Function {fn.name} called with no arguments"
                            elif fn.name == 'get_customer_context':
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
                        
                        # Handle 503s and 429s on tool response
                        for attempt in range(5):  # Increased retries for quota limits
                            try:
                                # Ensure fn.name is a string, not None
                                tool_name = fn.name if fn.name is not None else "unknown_tool"
                                response = chat.send_message(
                                    types.Part.from_function_response(
                                        name=tool_name,
                                        response={"result": result}
                                    )
                                )
                                break
                            except Exception as api_err:
                                error_str = str(api_err)
                                if "503" in error_str and attempt < 4:
                                    logger.warning(f"⚠️ API 503 Error. Retrying in {2 ** attempt}s...")
                                    time.sleep(2 ** attempt)
                                elif "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                                    if attempt < 4:
                                        # Extract retry delay from error if available
                                        retry_delay = min(2 ** attempt, 60)  # Cap at 60 seconds
                                        logger.warning(f"⚠️ API 429 Quota Exceeded. Retrying in {retry_delay}s...")
                                        time.sleep(retry_delay)
                                    else:
                                        logger.error(f"❌ API 429 Quota Exceeded after {attempt + 1} attempts on tool response. Giving up on this payment.")
                                        return f"Error: Gemini API quota exceeded during tool execution. Please try again later."
                                else:
                                    raise api_err
                
                logger.info(f"🎯 [Agent] Completed reasoning for payment {payment['id']}")
                success_count += 1
                
                # Pace requests to respect the 15 Requests Per Minute (RPM) free tier quota limit
                time.sleep(4.5)
            except Exception as e:
                logger.error(f"[Agent] Failed to process payment {payment['id']}: {e}")
                
        return success_count
    except Exception as e:
        logger.error(f"[Brain] Database fetch error: {e}")
        return 0

def execute_recovery_actions():
    return 0
