# Spec: Slice 04 - Execution Layer

## Objective
Read the pending strategies decided by the AI Brain, enforce our strict stopping rules (max 3 retries, no contact after 10 PM), and execute the recovery action by calling the Razorpay API to generate a Payment Link.

## System Bounds
- **In Scope**:
  - Fetching `status = 'pending'` actions from the `recovery_actions` table.
  - Enforcing the "Max 3 Attempts" rule.
  - Enforcing the "No Contact After 10 PM" rule.
  - Calling the Razorpay Node.js SDK to create a Payment Link.
  - Updating the `recovery_actions` status to `executed` or `failed`.
- **Out of Scope**:
  - Processing successful payments (that will be a separate webhook listener).
  - Actually sending SMS/Email (we will just generate the Razorpay link, which Razorpay can automatically email/SMS if configured, or we just log it for the demo).

## Inputs / Outputs
- **Inputs**: `POST /api/agent/execute`
- **Outputs**: JSON summary of executed actions.

## API Contracts
- **Razorpay SDK**: We will use `razorpay.paymentLink.create()` to generate the recovery link.
  - Requires `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env.local`.

## Edge Cases & Failure Modes
- **Stopping Rule - Max Retries**: If a payment has 3 or more executed actions, we do not execute anymore. We mark the payment as `max_retries_reached`.
- **Stopping Rule - Time Bounds**: If the current time in IST is >= 22:00 (10 PM) or <= 08:00 (8 AM), we skip execution and leave it as `pending`.
- **Razorpay API Failure**: If creating the payment link fails (e.g., invalid API keys), we catch the error, leave the action as `pending`, and log loudly.
