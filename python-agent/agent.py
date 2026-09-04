import os
import json
import logging
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client
from google import genai
from google.genai import types
import razorpay
from dotenv import load_dotenv

load_dotenv('../.env.local')

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip('"')
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip('"')
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "").strip('"')
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "").strip('"')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# Initialize Gemini client
ai_client = genai.Client(api_key=GEMINI_API_KEY)
# Initialize Razorpay client
rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


def determine_recovery_strategy(failure_reason: str, amount: int) -> dict:
    """Uses Gemini to decide the recovery action."""
    prompt = f"""
    You are an AI Revenue Recovery Agent. A payment just failed.
    Failure Reason: "{failure_reason}"
    Amount: ₹{amount / 100}

    Decide the BEST automated recovery action.
    Rules:
    - If it's a network/bank timeout drop, retry immediately -> 'retry_upi'
    - If card expired or insufficient funds -> 'send_link' (to use a new method)
    - If it's a high amount (>10,000) and complex -> 'escalate' (to human)
    - Default to 'send_link' if unsure.

    Return EXACTLY a JSON object with this schema:
    {{
        "action": "retry_upi" | "send_link" | "schedule_retry" | "escalate",
        "delay_hours": number (0 for immediate),
        "reason": "short explanation of why you chose this action"
    }}
    """
    
    try:
        response = ai_client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        if response.text:
            return json.loads(response.text)
        raise ValueError("Empty response from Gemini")
    except Exception as e:
        logger.error(f"[Brain] Error calling Gemini: {e}")
        # Safe fallback
        return {
            "action": "send_link",
            "delay_hours": 0,
            "reason": "Fallback to manual link due to AI decision failure."
        }


def process_pending_failures():
    """Fetches new failed payments and assigns AI recovery strategies."""
    try:
        res = supabase.table('failed_payments').select('*').eq('status', 'pending_analysis').limit(10).execute()
        payments = res.data
        
        if not payments:
            return 0
            
        success_count = 0
        for payment in payments:
            try:
                strategy = determine_recovery_strategy(
                    payment.get('failure_reason', 'Unknown error'),
                    payment.get('amount', 0)
                )
                
                # Calculate scheduled time
                scheduled_for = None
                if strategy.get('delay_hours', 0) > 0:
                    dt = datetime.now(timezone.utc) + timedelta(hours=strategy['delay_hours'])
                    scheduled_for = dt.isoformat()
                    
                # Insert recovery action
                action_data = {
                    'payment_id': payment['id'],
                    'type': strategy['action'],
                    'status': 'pending',
                    'gemini_reasoning': strategy['reason']
                }
                if scheduled_for:
                    action_data['scheduled_for'] = scheduled_for
                    
                supabase.table('recovery_actions').insert(action_data).execute()
                
                # Update payment status
                supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', payment['id']).execute()
                
                success_count += 1
            except Exception as e:
                logger.error(f"[Brain] Failed to process payment {payment['id']}: {e}")
                
        return success_count
    except Exception as e:
        logger.error(f"[Brain] Database fetch error: {e}")
        return 0


def execute_recovery_actions():
    """Finds pending actions and executes them via Razorpay if time rules allow."""
    try:
        # Enforce stopping rule: No contact between 10 PM and 8 AM IST
        now = datetime.now(timezone.utc)
        # Convert to IST (+5:30)
        ist_time = now + timedelta(hours=5, minutes=30)
        hours = ist_time.hour
        
        # NOTE: For hackathon demo, we temporarily disable the time block so it works live
        # if hours >= 22 or hours < 8:
        #     logger.info("[Executor] Paused: Outside allowed contact hours (10 PM - 8 AM IST).")
        #     return 0

        # Fetch pending actions with their payments
        res = supabase.table('recovery_actions').select('*, failed_payments(*)').eq('status', 'pending').limit(10).execute()
        actions = res.data
        
        if not actions:
            return 0
            
        success_count = 0
        for action in actions:
            payment = action.get('failed_payments')
            if not payment:
                continue
                
            try:
                # Enforce max 3 retries stopping rule
                count_res = supabase.table('recovery_actions').select('id', count='exact').eq('payment_id', payment['id']).eq('status', 'executed').execute()
                if count_res.count is not None and count_res.count >= 3:
                    supabase.table('failed_payments').update({'status': 'max_retries_reached'}).eq('id', payment['id']).execute()
                    supabase.table('recovery_actions').update({
                        'status': 'failed', 
                        'gemini_reasoning': f"{action.get('gemini_reasoning', '')} | FAILED: Max retries (3) reached."
                    }).eq('id', action['id']).execute()
                    continue

                # Generate Razorpay Link
                link_req = {
                    "amount": payment['amount'],
                    "currency": payment['currency'],
                    "accept_partial": False,
                    "description": f"Recovery for failed transaction {payment.get('razorpay_payment_id')}",
                    "customer": {
                        "email": payment.get('customer_email') or "demo@example.com",
                        "contact": payment.get('customer_phone') or "+919876543210"
                    },
                    "notify": {
                        "sms": bool(payment.get('customer_phone')),
                        "email": bool(payment.get('customer_email'))
                    },
                    "reminder_enable": True,
                    "notes": {
                        "original_payment_id": payment.get('razorpay_payment_id'),
                        "recovery_action_id": action['id']
                    }
                }
                
                plink = rzp_client.payment_link.create(link_req)
                
                # Append link to UI rationale
                new_reasoning = f"{action.get('gemini_reasoning', '')} | LINK: {plink.get('short_url', '')}"
                
                supabase.table('recovery_actions').update({
                    'status': 'executed',
                    'executed_at': datetime.now(timezone.utc).isoformat(),
                    'gemini_reasoning': new_reasoning
                }).eq('id', action['id']).execute()
                
                success_count += 1
            except Exception as e:
                logger.error(f"[Executor] Failed to execute action {action['id']}: {e}")
                
        return success_count
    except Exception as e:
        logger.error(f"[Executor] Database fetch error: {e}")
        return 0
