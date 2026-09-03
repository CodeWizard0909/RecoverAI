import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { determineRecoveryStrategy } from '@/lib/agent';

export async function POST() {
  try {
    // 1. Fetch up to 10 pending payments
    const { data: payments, error: fetchError } = await supabaseAdmin
      .from('failed_payments')
      .select('*')
      .eq('status', 'pending_analysis')
      .limit(10);

    if (fetchError) {
      console.error('[Batch Processor] Error fetching pending payments:', fetchError);
      return NextResponse.json({ error: 'Database fetch failed' }, { status: 500 });
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ message: 'No pending payments to process.', processed: 0 }, { status: 200 });
    }

    console.log(`[Batch Processor] Found ${payments.length} payments to analyze.`);
    let successCount = 0;
    const actionsTaken: Record<string, number> = {
      retry_upi: 0,
      send_link: 0,
      schedule_retry: 0,
      escalate: 0
    };

    // 2. Process each payment (sequentially for now to avoid rate limits, though Promise.all is faster)
    for (const payment of payments) {
      try {
        // Ask Gemini for the strategy
        const strategy = await determineRecoveryStrategy(
          payment.amount,
          payment.currency,
          payment.failure_reason
        );

        // Record the action in the audit trail
        const { error: actionError } = await supabaseAdmin
          .from('recovery_actions')
          .insert({
            payment_id: payment.id,
            type: strategy.action,
            gemini_reasoning: strategy.reasoning,
            status: 'pending' // pending execution in Slice 04
          });

        if (actionError) throw actionError;

        // Update payment status
        const { error: updateError } = await supabaseAdmin
          .from('failed_payments')
          .update({ status: 'recovery_in_progress', updated_at: new Date().toISOString() })
          .eq('id', payment.id);

        if (updateError) throw updateError;

        successCount++;
        actionsTaken[strategy.action]++;
        
      } catch (err) {
        console.error(`[Batch Processor] Failed to process payment ${payment.id}:`, err);
        // We leave the payment as 'pending_analysis' so it gets retried on the next batch run
      }
    }

    return NextResponse.json({
      message: 'Batch processing complete',
      processed: successCount,
      actions: actionsTaken
    }, { status: 200 });

  } catch (error) {
    console.error('[Batch Processor] Unhandled Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
