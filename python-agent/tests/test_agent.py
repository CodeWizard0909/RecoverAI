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

# =========================================================================
# LOOP & VALIDATION TESTS
# =========================================================================

from agent import process_pending_failures
from pydantic import ValidationError

@patch('agent.ai_client')
@patch('agent.supabase')
def test_process_pending_failures(mock_supabase, mock_ai_client):
    # Mock supabase queries
    mock_failed_payments = MagicMock()
    mock_failed_payments.data = [{'id': 'pay_test', 'amount': 100000, 'failure_reason': 'test', 'customer_email': 'test@test.com'}]
    
    mock_existing_actions = MagicMock()
    mock_existing_actions.count = 0
    
    # When table() is called, return a mock that handles both select chains
    def table_side_effect(name):
        mock_table = MagicMock()
        if name == 'failed_payments':
            mock_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_failed_payments
        elif name == 'recovery_actions':
            mock_table.select.return_value.eq.return_value.execute.return_value = mock_existing_actions
        return mock_table
        
    mock_supabase.table.side_effect = table_side_effect
    
    # Mock gemini chat session
    mock_chat = MagicMock()
    mock_ai_client.chats.create.return_value = mock_chat
    
    # Mock LLM sending a tool call
    mock_response = MagicMock()
    mock_fn_call = MagicMock()
    mock_fn_call.name = 'get_customer_context'
    mock_fn_call.args = {'email': 'test@test.com'}
    mock_response.function_calls = [mock_fn_call]
    
    # Second turn: LLM stops tool calling
    mock_response_done = MagicMock()
    mock_response_done.function_calls = []
    
    mock_chat.send_message.side_effect = [mock_response, mock_response_done]
    
    success_count = process_pending_failures()
    assert success_count == 1
    mock_chat.send_message.assert_called()

from agent import EscalateArgs
def test_pydantic_validation_error():
    with pytest.raises(ValidationError):
        # Missing required strategy_reasoning, amount is wrong type
        EscalateArgs(payment_id="pay_123", amount="not_an_int", reason="Network drop")
