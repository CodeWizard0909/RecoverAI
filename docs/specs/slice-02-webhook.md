# Spec: Slice 02 - Webhook Ingestion Layer

## Objective
Create a Next.js API route that securely receives Razorpay webhooks, verifies their cryptographic signature, and inserts the failed payment data into the Supabase `failed_payments` table.

## System Bounds
- **In Scope**: 
  - Next.js App Router API Route (`src/app/api/webhooks/razorpay/route.ts`).
  - Razorpay SDK signature verification.
  - Supabase server-side client setup (`src/lib/supabase.ts`).
  - Inserting into `failed_payments`.
- **Out of Scope**: Triggering the AI agent, UI dashboard, processing successful payments.

## Inputs / Outputs
- **Inputs**: POST request from Razorpay containing the event payload (e.g., `payment.failed`) and the `x-razorpay-signature` header.
- **Outputs**: 
  - `200 OK` (Empty response) if successfully processed.
  - `400 Bad Request` if signature fails.
  - `500 Internal Server Error` if DB insert fails (unless it's a duplicate).

## API Contracts
- **Supabase Client**: We must use `@supabase/supabase-js` with the `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security (RLS).
- **Database Mapping**:
  - `razorpay_payment_id` <- `payload.payload.payment.entity.id`
  - `amount` <- `payload.payload.payment.entity.amount`
  - `currency` <- `payload.payload.payment.entity.currency`
  - `failure_reason` <- `payload.payload.payment.entity.error_description`
  - `customer_email` <- `payload.payload.payment.entity.email`
  - `customer_phone` <- `payload.payload.payment.entity.contact`

## Edge Cases & Failure Modes
- **Duplicate Webhooks**: Supabase will throw a unique constraint error (code `23505`) if Razorpay retries a webhook we already processed. We must catch this specific error, log it as "already processed", and return `200 OK` to Razorpay so they stop retrying.
- **Missing Signature**: If the `x-razorpay-signature` header is missing, immediately return `400`.
- **Missing Razorpay Secret**: The app must throw an error on startup if `RAZORPAY_WEBHOOK_SECRET` is missing.
