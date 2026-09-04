import { NextResponse } from 'next/server';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

export async function POST(req: Request) {
  try {
    const { amount, currency, paymentId, email, phone } = await req.json();

    if (!amount || !paymentId) {
      return NextResponse.json({ error: 'Missing amount or paymentId' }, { status: 400 });
    }

    // Create a Razorpay Order via REST API
    const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: amount,
        currency: currency || 'INR',
        receipt: `recovery_${paymentId}`,
        notes: {
          original_payment_id: paymentId,
          recovery_type: 'ai_recovery'
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Create Order] Razorpay error:', err);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const order = await response.json();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      email: email || 'demo@example.com',
      phone: phone || '+919876543210',
      paymentId,
    });
  } catch (error) {
    console.error('[Create Order]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
