# Slice 10: Transition to Real Autonomous Agent (Tool Calling)

## Goal
Transition the Python backend from a deterministic "JSON-parser" pipeline into a true Autonomous Agent using Native Tool Calling (Function Calling) with the new `google-genai` SDK.

## Current State (V1)
- **Pipeline**: Hardcoded `determine_recovery_strategy` takes a string prompt containing injected customer data, returns a strict JSON object.
- **Executor**: A separate `execute_recovery_actions` function runs a giant `if/elif` block based on the JSON `action` field to call Razorpay.

## Target Architecture (V2)
- **Agentic Loop**: We will define Python functions (Tools) that the Gemini model can call directly.
- **Tools**:
  1. `get_customer_context(email: str)`: Queries Supabase for LTV and prior failure counts.
  2. `create_recovery_link(payment_id: str, amount: int, is_partial: bool, strategy_reasoning: str)`: Generates the Razorpay link and logs the action to Supabase.
  3. `escalate_to_human(payment_id: str, amount: int, reason: str, strategy_reasoning: str)`: Sends the Slack webhook and logs the escalation.
- **Execution**: The `process_pending_failures` loop will invoke the agent with the failure event and provide the tools. The agent will autonomously gather context via `get_customer_context`, reason about the churn risk, and finally call either `create_recovery_link` or `escalate_to_human`.

## Failure Modes & Guardrails
- **Tool Hallucination**: The agent might call tools with wrong arguments. We must use Pydantic or strict type hints for the tool definitions.
- **Infinite Loops**: We must limit the model to a maximum of 3 tool call iterations per payment to prevent infinite loops.
- **Error Handling**: Tool functions must catch exceptions and return them as strings to the agent so it can self-correct, rather than crashing the loop.

## Changes
- Remove the rigid JSON prompt in `agent.py`.
- Define Python functions with clear docstrings for the `google-genai` SDK to use as tools.
- Refactor the APScheduler to just run the Agent Loop for new pending failures.
