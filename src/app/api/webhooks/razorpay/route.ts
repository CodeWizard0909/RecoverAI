import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error('FATAL: RAZORPAY_WEBHOOK_SECRET is not set in environment variables.');
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      console.error('[Webhook] Missing x-razorpay-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET!)
      .update(bodyText)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Parse the verified payload
    const event = JSON.parse(bodyText);

    // Only process payment.failed events for now
    if (event.event !== 'payment.failed') {
      console.log(`[Webhook] Ignored event type: ${event.event}`);
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const payment = event.payload.payment.entity;

    // Insert into Supabase
    const { error: insertError } = await supabaseAdmin.from('failed_payments').insert({
      razorpay_payment_id: payment.id,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      failure_reason: payment.error_description || payment.error_code || 'Unknown error',
      customer_email: payment.email || null,
      customer_phone: payment.contact || null,
      status: 'pending_analysis'
    });

    if (insertError) {
      // Handle the duplicate webhook edge case defined in the spec
      if (insertError.code === '23505') { // Postgres unique violation
        console.log(`[Webhook] Payment ${payment.id} already processed. Ignoring duplicate.`);
        return NextResponse.json({ status: 'duplicate_ignored' }, { status: 200 });
      }
      
      console.error(`[Webhook] DB Insert Error for ${payment.id}:`, insertError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log(`[Webhook] Successfully ingested failed payment: ${payment.id}`);
    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    // No bare exceptions per our guidelines. Fail loudly.
    console.error('[Webhook] Unhandled Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
