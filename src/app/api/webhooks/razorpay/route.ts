import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    // Verify signature if secret is configured (skip in dev mode)
    if (WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(bodyText)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('[Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(bodyText);
    console.log(`[Webhook] Received event: ${event.event}`);

    // --- CASE 1: New failed payment — ingest into DB ---
    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
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
        if (insertError.code === '23505') {
          console.log(`[Webhook] Duplicate payment ${payment.id}. Ignored.`);
          return NextResponse.json({ status: 'duplicate_ignored' }, { status: 200 });
        }
        console.error(`[Webhook] DB insert error for ${payment.id}:`, insertError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      console.log(`[Webhook] Ingested failed payment: ${payment.id}`);
      return NextResponse.json({ status: 'success' }, { status: 200 });
    }

    // --- CASE 2: Recovery payment link was paid — mark as recovered ---
    if (event.event === 'payment_link.paid') {
      const paymentLink = event.payload.payment_link.entity;
      const notes = paymentLink.notes || {};
      const originalPaymentId = notes.original_payment_id as string | undefined;
      const recoveryActionId = notes.recovery_action_id as string | undefined;

      if (!originalPaymentId && !recoveryActionId) {
        console.log('[Webhook] payment_link.paid has no recovery notes, skipping.');
        return NextResponse.json({ status: 'ignored_no_notes' }, { status: 200 });
      }

      // Mark the recovery action as executed
      if (recoveryActionId) {
        await supabaseAdmin
          .from('recovery_actions')
          .update({ status: 'executed', executed_at: new Date().toISOString() })
          .eq('id', recoveryActionId);
      }

      // Mark the original failed payment as fully recovered
      if (originalPaymentId) {
        await supabaseAdmin
          .from('failed_payments')
          .update({ status: 'recovered' })
          .eq('razorpay_payment_id', originalPaymentId);
        console.log(`[Webhook] ✅ Payment ${originalPaymentId} marked as RECOVERED.`);
      }

      return NextResponse.json({ status: 'recovered' }, { status: 200 });
    }

    // --- Default: ignore unknown events ---
    console.log(`[Webhook] Ignored event type: ${event.event}`);
    return NextResponse.json({ status: 'ignored' }, { status: 200 });

  } catch (error) {
    console.error('[Webhook] Unhandled Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
