import pytest
from unittest.mock import patch, MagicMock

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent import determine_recovery_strategy

@patch('agent.ai_client.models.generate_content')
def test_determine_recovery_strategy(mock_generate):
    # Mock Gemini response
    mock_response = MagicMock()
    mock_response.text = '{"action": "retry_upi", "delay_hours": 0, "reason": "Network error"}'
    mock_generate.return_value = mock_response

    result = determine_recovery_strategy("customer network drop", 149900)
    
    assert result['action'] == 'retry_upi'
    assert result['delay_hours'] == 0
    assert result['reason'] == 'Network error'
