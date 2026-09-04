import pytest
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the new tools
from agent import get_customer_context, escalate_payment, generate_recovery_link

def test_get_customer_context():
    # It should return a default dict if we pass demo emails
    context = get_customer_context("vip@example.com")
    assert context['lifetime_value'] == 120000
    assert 'previous_failures_this_year' in context

@patch('agent.supabase')
def test_escalate_payment(mock_supabase):
    # Mock supabase responses
    mock_supabase.table().select().eq().single().execute.return_value = MagicMock(data={'amount': 100000})
    
    # Tool call
    result = escalate_payment("pay_123", "High risk VIP", 90)
    
    assert "Successfully escalated" in result
    mock_supabase.table().insert.assert_called()

@patch('agent.rzp_client')
@patch('agent.supabase')
def test_generate_recovery_link(mock_supabase, mock_rzp):
    mock_supabase.table().select().eq().single().execute.return_value = MagicMock(
        data={'amount': 150000, 'currency': 'INR', 'razorpay_payment_id': 'rzp_456'}
    )
    mock_rzp.payment_link.create.return_value = {"short_url": "https://rzp.io/l/mock"}
    
    result = generate_recovery_link("pay_123", False, "Network drop, standard retry", 40)
    
    assert "Successfully generated recovery link" in result
    mock_rzp.payment_link.create.assert_called_once()
    mock_supabase.table().insert.assert_called()
