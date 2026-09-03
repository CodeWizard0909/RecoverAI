# Spec: Slice 03 - The AI Brain

## Objective
Create the Gemini-powered decision engine that analyzes failed payments, determines the optimal recovery strategy, and logs the planned action to the database.

## System Bounds
- **In Scope**: 
  - A Next.js API route (`/api/agent/process-batch`) that acts as the trigger for the AI agent.
  - Fetching payments with `status = 'pending_analysis'` from Supabase.
  - Calling the Gemini API using structured JSON output.
  - Inserting the decided action into the `recovery_actions` table.
  - Updating the payment status to `recovery_in_progress`.
- **Out of Scope**: Actually executing the action (e.g., sending the SMS or firing the retry API). That is the Execution Layer (Slice 04).

## Inputs / Outputs
- **Inputs**: 
  - A `POST` request to `/api/agent/process-batch` (Can be triggered by a "Simulate Batch" button in the UI).
- **Outputs**: 
  - JSON response summarizing the batch results (e.g., `{ processed: 5, strategies: { retry_upi: 2, send_link: 3 } }`).

## API Contracts
- **Gemini Model**: We will use `gemini-2.5-flash` (or `gemini-2.0-flash` depending on the SDK) for speed.
- **Gemini Output Schema**: We will force Gemini to return JSON matching this exact structure:
  ```json
  {
    "action": "retry_upi" | "send_link" | "schedule_retry" | "escalate",
    "reasoning": "A short explanation of why this action was chosen based on the failure_reason."
  }
  ```

## Edge Cases & Failure Modes
- **Gemini API Failure**: If the Gemini API rate limits or throws an error, we catch it, log it, and leave the payment in `pending_analysis` status so it gets picked up on the next batch run.
- **Malformed JSON**: Using Gemini's `responseSchema` guarantees the structure, preventing JSON parse errors.
- **Empty Batch**: If there are 0 pending payments, return a 200 OK immediately without calling Gemini to save API costs.
