# Spec: Slice 01 - Setup & Data Layer

## Objective
Initialize the project infrastructure, configure the Next.js frontend, set up the Supabase database schema for tracking failed payments and recovery actions, and establish TypeScript interfaces.

## System Bounds
- **In Scope**: Next.js project initialization, Supabase SQL schema definitions, TypeScript type definitions for the database, strict dependency pinning.
- **Out of Scope**: UI components, webhook endpoints, AI logic, Python backend (to be handled in later slices).

## Inputs / Outputs
- **Inputs**: Supabase credentials (to be provided via `.env`).
- **Outputs**: A running Next.js application, defined SQL tables in Supabase, and generated TypeScript types.

## Database Schema (API Contracts)

### Table: `failed_payments`
Tracks the original failed transactions.
- `id` (UUID, PK)
- `razorpay_payment_id` (String, Unique)
- `amount` (Integer - in paise)
- `currency` (String)
- `failure_reason` (String)
- `customer_id` (String, nullable)
- `customer_email` (String, nullable)
- `customer_phone` (String, nullable)
- `status` (Enum: `pending_analysis`, `recovery_in_progress`, `recovered`, `failed`, `max_retries_reached`)
- `recovery_amount` (Integer - in paise, default 0)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Table: `recovery_actions`
Audit trail of actions taken by the AI agent.
- `id` (UUID, PK)
- `payment_id` (UUID, FK to `failed_payments.id`)
- `action_type` (Enum: `retry_upi`, `send_link`, `schedule_retry`, `escalate`)
- `status` (Enum: `pending`, `executed`, `failed`)
- `gemini_reasoning` (Text - explanation of why AI chose this action)
- `scheduled_for` (Timestamp, nullable - for delayed actions)
- `executed_at` (Timestamp, nullable)
- `created_at` (Timestamp)

## Edge Cases & Failure Modes
- **Duplicate Webhooks**: The `razorpay_payment_id` must have a UNIQUE constraint so that if Razorpay sends the same webhook twice, the database rejects the duplicate insert rather than processing it twice.
- **Invalid Data Types**: Enforce constraints at the DB level (e.g., amount >= 0).
