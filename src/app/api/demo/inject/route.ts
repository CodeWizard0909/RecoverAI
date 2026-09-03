import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret_123';
  const ENDPOINT = req.url.replace('/api/demo/inject', '/api/webhooks/razorpay');

  const payload = {
    entity: 'event',
    account_id: 'acc_1234567890',
    event: 'payment.failed',
    contains: ['payment'],
    payload: {
      payment: {
        entity: {
          id: `pay_mock_${Date.now()}`, 
          entity: 'payment',
          amount: 149900,
          currency: 'INR',
          status: 'failed',
          error_code: 'BAD_REQUEST_ERROR',
          error_description: 'Payment failed due to customer network drop.',
          email: 'demo@example.com',
          contact: '+919876543210',
        }
      }
    },
    created_at: Math.floor(Date.now() / 1000)
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payloadString)
    .digest('hex');

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature
      },
      body: payloadString
    });

    return NextResponse.json({ success: response.ok, status: response.status });
  } catch {
    return NextResponse.json({ error: 'Failed to inject webhook' }, { status: 500 });
  }
}
