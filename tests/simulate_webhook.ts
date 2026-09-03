import crypto from 'crypto';

/**
 * Verification Harness for Webhook Ingestion (Slice 02)
 * 
 * According to our rules (Write tests first), this script defines the "correct" behavior.
 * It simulates Razorpay sending a `payment.failed` webhook to our Next.js API route.
 * 
 * Usage (once server is running):
 * npx tsx tests/simulate_webhook.ts
 */

const WEBHOOK_SECRET = 'test_secret_123'; // Must match RAZORPAY_WEBHOOK_SECRET in .env.local
const ENDPOINT = 'http://localhost:3000/api/webhooks/razorpay';

// Mock Razorpay Payload matching the API Contract in spec-slice-02-webhook.md
const payload = {
  entity: 'event',
  account_id: 'acc_1234567890',
  event: 'payment.failed',
  contains: ['payment'],
  payload: {
    payment: {
      entity: {
        id: `pay_mock_${Date.now()}`, // Unique ID every time to avoid constraint errors initially
        entity: 'payment',
        amount: 149900, // ₹1,499.00
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Payment failed due to customer network drop.',
        email: 'customer@example.com',
        contact: '+919876543210',
      }
    }
  },
  created_at: Math.floor(Date.now() / 1000)
};

const payloadString = JSON.stringify(payload);

// Razorpay generates the signature using HMAC SHA256
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payloadString)
  .digest('hex');

async function runTest() {
  console.log(`[TEST] Firing mock webhook to ${ENDPOINT}...`);
  console.log(`[TEST] Payment ID: ${payload.payload.payment.entity.id}`);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature
      },
      body: payloadString
    });

    if (response.ok) {
      console.log('✅ [PASS] Webhook accepted (200 OK).');
      console.log('👉 Next step: Check your Supabase `failed_payments` table to verify the row was inserted.');
    } else {
      console.error(`❌ [FAIL] Server returned ${response.status}: ${await response.text()}`);
    }
  } catch (err) {
    console.error('❌ [ERROR] Could not connect to the local server. Is it running?', err);
  }
}

runTest();
