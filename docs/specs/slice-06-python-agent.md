# Spec: Slice 06 - Python FastAPI Background Agent

## Objective
Extract the AI Brain (Gemini) and Execution (Razorpay) logic out of the Next.js API routes and into a standalone, persistent Python FastAPI microservice. This fulfills the core architectural requirement to have a dedicated background agent that won't timeout on Vercel.

## System Bounds
- **In Scope**: A Python FastAPI application, `APScheduler` for running periodic batch jobs, Supabase Python client for DB reads/writes, Gemini Python SDK for AI reasoning, Razorpay Python SDK for execution.
- **Out of Scope**: Next.js API routes (we will deprecate `/api/agent/process-batch` and `/api/agent/execute` in favor of this Python service).

## Inputs / Outputs
- **Inputs**: Environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
- **Outputs**: Background jobs that autonomously poll `failed_payments` and execute `recovery_actions`.

## API Contracts / Scheduler
- **Job 1: `process_pending_failures`**: Runs every 1 minute. Finds `pending_analysis` payments, calls Gemini, creates `recovery_actions`.
- **Job 2: `execute_recovery_actions`**: Runs every 1 minute. Finds `pending` actions, enforces stopping rules (time of day, max retries), calls Razorpay to generate links, updates DB.
- **FastAPI Routes**: `/health` (GET) for deployment health checks, `/trigger` (POST) to manually fire the batch for UI demo purposes.

## Edge Cases & Failure Modes
- **Concurrency**: If a job takes longer than 1 minute, APScheduler must be configured to not spawn overlapping instances of the same job (use `max_instances=1`).
- **Timezone Compliance**: The Python agent must enforce the 10 PM - 8 AM IST stopping rule just like the Node version did.
- **Missing Keys**: Must fail loudly on startup if environment variables are missing.
