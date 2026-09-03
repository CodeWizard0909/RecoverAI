-- Supabase SQL schema for RecoverAI

-- Enum types for status tracking
CREATE TYPE payment_status AS ENUM (
  'pending_analysis', 
  'recovery_in_progress', 
  'recovered', 
  'failed', 
  'max_retries_reached'
);

CREATE TYPE action_type AS ENUM (
  'retry_upi', 
  'send_link', 
  'schedule_retry', 
  'escalate'
);

CREATE TYPE action_status AS ENUM (
  'pending', 
  'executed', 
  'failed'
);

-- Table: failed_payments
CREATE TABLE failed_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razorpay_payment_id VARCHAR(255) UNIQUE NOT NULL,
    amount INTEGER NOT NULL CHECK (amount >= 0), -- Amount in paise
    currency VARCHAR(3) DEFAULT 'INR',
    failure_reason TEXT NOT NULL,
    customer_id VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    status payment_status DEFAULT 'pending_analysis'::payment_status NOT NULL,
    recovery_amount INTEGER DEFAULT 0 CHECK (recovery_amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: recovery_actions
CREATE TABLE recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES failed_payments(id) ON DELETE CASCADE,
    type action_type NOT NULL,
    status action_status DEFAULT 'pending'::action_status NOT NULL,
    gemini_reasoning TEXT,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for quick lookups on payment ID
CREATE INDEX idx_recovery_actions_payment_id ON recovery_actions(payment_id);
CREATE INDEX idx_failed_payments_razorpay_id ON failed_payments(razorpay_payment_id);
