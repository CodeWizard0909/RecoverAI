import pytest
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the new tools
from agent import get_customer_context, escalate_to_human, create_recovery_link

def test_get_customer_context():
    # It should return a default dict if we pass demo emails
    context = get_customer_context("vip@example.com")
    assert context['lifetime_value'] == 120000
    assert 'previous_failures_this_year' in context

@patch('agent.supabase')
def test_escalate_to_human(mock_supabase):
    # Tool call
    result = escalate_to_human(payment_id="pay_123", amount=100000, reason="Network error", strategy_reasoning="VIP customer High risk")
    
    assert "Successfully escalated" in result
    mock_supabase.table().insert.assert_called()

@patch('agent.rzp_client')
@patch('agent.supabase')
def test_create_recovery_link(mock_supabase, mock_rzp):
    mock_supabase.table().select().eq().single().execute.return_value = MagicMock(
        data={'currency': 'INR', 'customer_email': 'test@test.com', 'customer_phone': '999', 'razorpay_payment_id': 'rzp_456'}
    )
    mock_rzp.payment_link.create.return_value = {"short_url": "https://rzp.io/l/mock"}
    
    result = create_recovery_link(payment_id="pay_123", amount=150000, is_partial=False, strategy_reasoning="Standard retry link")
    
    assert "Successfully created recovery link" in result
    mock_rzp.payment_link.create.assert_called_once()
    mock_supabase.table().insert.assert_called()
