import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { razorpayClient } from '@/lib/razorpay';

export async function POST() {
  try {
    // Check Time Stopping Rule (No contact between 10 PM and 8 AM IST)
    const now = new Date();
    // Convert to IST (UTC +5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours(); // getUTCHours on the adjusted time gives the local IST hours

    // If it's strictly >= 22 (10 PM) or < 8 (8 AM)
    if (hours >= 22 || hours < 8) {
      console.log('[Executor] Paused: Outside allowed contact hours (10 PM - 8 AM).');
      return NextResponse.json({ message: 'Paused due to time constraints' }, { status: 200 });
    }

    // 1. Fetch pending actions
    // Note: Supabase JS syntax for joins: select('*, failed_payments(*)')
    const { data: actions, error: fetchError } = await supabaseAdmin
      .from('recovery_actions')
      .select(`
        *,
        failed_payments (
          id, amount, currency, customer_email, customer_phone, razorpay_payment_id
        )
      `)
      .eq('status', 'pending')
      .limit(10);

    if (fetchError) {
      console.error('[Executor] Error fetching actions:', fetchError);
      return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
    }

    if (!actions || actions.length === 0) {
      return NextResponse.json({ message: 'No pending actions to execute.', executed: 0 }, { status: 200 });
    }

    let successCount = 0;

    for (const action of actions) {
      const payment = action.failed_payments;
      if (!payment) continue;

      try {
        // Check Retry Limit Stopping Rule
        const { count, error: countError } = await supabaseAdmin
          .from('recovery_actions')
          .select('*', { count: 'exact', head: true })
          .eq('payment_id', payment.id)
          .eq('status', 'executed');
        
        if (countError) throw countError;

        if (count !== null && count >= 3) {
          console.log(`[Executor] Payment ${payment.id} has reached max retries (3). Marking as max_retries_reached.`);
          
          await supabaseAdmin.from('failed_payments').update({ status: 'max_retries_reached' }).eq('id', payment.id);
          // Mark this action as failed/skipped
          await supabaseAdmin.from('recovery_actions').update({ status: 'failed' }).eq('id', action.id);
          continue;
        }

        // Execute the action (Generate Payment Link)
        // For this demo, we generate a payment link for all recovery strategies 
        // to simplify the execution layer while still proving we can hit Razorpay APIs.
        console.log(`[Executor] Generating Razorpay Payment Link for ${payment.id} via action ${action.type}`);
        
        const paymentLinkReq = {
          amount: payment.amount,
          currency: payment.currency,
          accept_partial: false,
          description: `Recovery for failed transaction ${payment.razorpay_payment_id}`,
          customer: {
            email: payment.customer_email || undefined,
            contact: payment.customer_phone || undefined,
          },
          notify: {
            sms: !!payment.customer_phone,
            email: !!payment.customer_email
          },
          reminder_enable: true,
          notes: {
            original_payment_id: payment.razorpay_payment_id,
            recovery_action_id: action.id
          }
        };

        // Note: This will fail if RAZORPAY_KEY_ID is missing or invalid.
        const plink = await razorpayClient.paymentLink.create(paymentLinkReq);
        console.log(`[Executor] Created Payment Link: ${plink.short_url}`);

        // Mark action as executed
        await supabaseAdmin
          .from('recovery_actions')
          .update({ status: 'executed', executed_at: new Date().toISOString() })
          .eq('id', action.id);

        successCount++;

      } catch (err) {
        console.error(`[Executor] Failed to execute action ${action.id}:`, err);
        // Leave it as pending so it can be retried, unless it's a fatal error.
      }
    }

    return NextResponse.json({
      message: 'Execution batch complete',
      executed: successCount
    }, { status: 200 });

  } catch (error) {
    console.error('[Executor] Unhandled Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
