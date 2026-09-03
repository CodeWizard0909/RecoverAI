# RecoverAI - Context & Constraints

## Architecture Overview
RecoverAI is an autonomous revenue recovery agent that detects failed payments, diagnoses the reason using AI, and executes recovery strategies.

### Stack
- **Frontend & API**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL) with Realtime subscriptions
- **AI Brain**: Gemini API (Structured JSON output)
- **Payments**: Razorpay Node.js SDK
- **Agent Runtime**: Python FastAPI + APScheduler (for persistent background batch processing)

## The "Do Not Do" List (Forbidden Patterns)
- **No `any` types**: TypeScript must be strictly typed.
- **No bare exceptions**: Never use `except:` or `catch (e) {}` without logging the error and context. Fail loudly and readably.
- **No direct SQL string concatenation**: Always use parameterized queries or the Supabase ORM/client.
- **No mocking the database in integration tests**: Test against a real or local Supabase instance.
- **No unpinned dependencies**: All packages in `package.json` and `requirements.txt` must have exact versions (no `^` or `~`).
- **No silent webhook failures**: All Razorpay webhooks must be logged, and failures must return appropriate HTTP status codes for retries.

## Key Decisions & Gotchas
- *TBD as we build.*

## Stopping Rules (To Be Enforced)
- Maximum of 3 recovery attempts per transaction.
- No automated customer contact (SMS/Email/WhatsApp links) after 10 PM local time.
