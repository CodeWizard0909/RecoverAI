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

# Dynamically resolve paths so it works no matter where the script is run from
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

    Here is the simulated customer metadata:
    - Lifetime Value (LTV): ₹1,20,000
    - Previous Failures this year: 2

    Task 1: Calculate a Churn Risk Score (0-100) based on the failure reason and customer history. High risk if they've failed multiple times.
    Task 2: Decide the automated recovery action.
    - If amount > ₹50,000 -> 'escalate' (to Slack/Human-in-the-loop)
    - If network error -> 'retry_upi'
    - If card expired/insufficient funds -> 'send_link'
    Task 3: Decide if we should offer a 'partial_payment' (bargaining) to save the transaction. If Churn Risk > 70% and error is funds-related, set this to true.

    Return EXACTLY a JSON object with this schema:
    {{
        "churn_risk_score": 85,
        "partial_payment_offered": true,
        "action": "retry_upi" | "send_link" | "schedule_retry" | "escalate",
        "delay_hours": number (0 for immediate),
        "reason": "short explanation of why you chose this action and risk score"
    }}
    """
    
    try:
        response = ai_client.models.generate_content(
            model='gemini-3.6-flash',
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
        print(f"[Brain] Error calling Gemini: {e}")
        return {
            "churn_risk_score": 50,
            "partial_payment_offered": False,
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
                    
                # Format the reasoning with tags for the UI to parse
                tags = f"[CHURN_RISK: {strategy.get('churn_risk_score', 0)}%]"
                if strategy.get('partial_payment_offered'):
                    tags += " [BARGAINING_ACTIVE]"
                
                final_reasoning = f"{tags} {strategy.get('reason', '')}"

                # Insert recovery action
                action_data = {
                    'payment_id': payment['id'],
                    'type': strategy['action'],
                    'status': 'pending',
                    'gemini_reasoning': final_reasoning
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
                    logger.warning(f"[Executor] Max retries reached for payment {payment['id']}. Halting.")
                    supabase.table('recovery_actions').update({'status': 'halted'}).eq('id', action['id']).execute()
                    continue

                if action['type'] == 'escalate':
                    # FEATURE 2: Human-in-the-Loop Slack Escalation
                    slack_payload = {
                        "text": f"🚨 VIP Payment Failed: ₹{payment['amount']/100}",
                        "blocks": [
                            {
                                "type": "section",
                                "text": {"type": "mrkdwn", "text": f"*VIP Payment Failed*\n*Amount:* ₹{payment['amount']/100}\n*Reason:* {payment.get('failure_reason')}\n*AI Recommendation:* {action.get('gemini_reasoning')}"}
                            },
                            {
                                "type": "actions",
                                "elements": [
                                    {"type": "button", "text": {"type": "plain_text", "text": "Approve Discount"}, "style": "primary", "value": "approve"},
                                    {"type": "button", "text": {"type": "plain_text", "text": "Deny & Cancel"}, "style": "danger", "value": "deny"}
                                ]
                            }
                        ]
                    }
                    print("\n" + "="*50)
                    print("🚀 [SLACK WEBHOOK FIRED] Human-in-the-loop requested!")
                    print(json.dumps(slack_payload, indent=2))
                    print("="*50 + "\n")
                    
                    supabase.table('recovery_actions').update({
                        'status': 'escalated_to_slack',
                        'executed_at': datetime.now(timezone.utc).isoformat()
                    }).eq('id', action['id']).execute()
                    continue

                # Check if bargaining was activated by the Brain
                is_bargaining = "[BARGAINING_ACTIVE]" in action.get('gemini_reasoning', '')
                
                # Generate Razorpay Link (Full Amount)
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
                new_reasoning = f"{action.get('gemini_reasoning', '')} | LINK: {plink.get('short_url', '')}"

                if is_bargaining:
                    # Generate a 50% partial payment link
                    partial_req = dict(link_req)
                    partial_req["amount"] = int(payment['amount'] / 2)
                    partial_req["description"] = f"Partial 50% Recovery Plan for {payment.get('razorpay_payment_id')}"
                    partial_plink = rzp_client.payment_link.create(partial_req)
                    new_reasoning += f" | PARTIAL_LINK: {partial_plink.get('short_url', '')}"
                
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
