import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_secret_123';
  const ENDPOINT = req.url.replace('/api/demo/inject', '/api/webhooks/razorpay');

  const isVIP = Math.random() > 0.6; // 40% chance of being a VIP payment
  const amount = isVIP ? 7500000 : 149900; // 75,000 INR vs 1,499 INR
  const email = isVIP ? 'vip_customer@enterprise.com' : 'demo@example.com';
  const errorDesc = isVIP 
    ? 'Payment failed due to suspected high-value limits.' 
    : 'Payment failed due to customer network drop.';

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
          amount: amount,
          currency: 'INR',
          status: 'failed',
          error_code: 'BAD_REQUEST_ERROR',
          error_description: errorDesc,
          email: email,
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
