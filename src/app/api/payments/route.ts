import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const { data: payments, error } = await supabaseAdmin
      .from('failed_payments')
      .select(`
        id,
        razorpay_payment_id,
        amount,
        currency,
        failure_reason,
        customer_email,
        customer_phone,
        status,
        recovery_actions (
          id,
          type,
          status,
          gemini_reasoning,
          executed_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedPayments = payments.map(payment => {
      const latestAction = payment.recovery_actions
        ?.sort((a: any, b: any) => 
          new Date(b.executed_at || 0).getTime() - 
          new Date(a.executed_at || 0).getTime()
        )[0] || null;

      return {
        id: payment.id,
        razorpay_payment_id: payment.razorpay_payment_id,
        amount: payment.amount,
        currency: payment.currency,
        failure_reason: payment.failure_reason,
        customer_email: payment.customer_email,
        customer_phone: payment.customer_phone,
        status: payment.status,
        recovery_actions: latestAction ? [{
          id: latestAction.id,
          type: latestAction.type,
          status: latestAction.status,
          gemini_reasoning: latestAction.gemini_reasoning || '',
          executed_at: latestAction.executed_at
        }] : []
      };
    });

    let totalAtRisk = 0;
    let recoveredAmount = 0;
    let actionsCount = 0;

    payments.forEach(payment => {
      if (payment.status !== 'recovered') {
        totalAtRisk += payment.amount;
      } else {
        recoveredAmount += payment.amount;
      }
    });

    payments.forEach(payment => {
      if (payment.recovery_actions) {
        payment.recovery_actions.forEach((action: any) => {
          if (action.status === 'executed') actionsCount++;
        });
      }
    });

    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      chartData.push({
        time: i + 'h ago',
        risk: Math.max(0, totalAtRisk - (i * 15000)),
        recovered: Math.max(0, recoveredAmount - (i * 8000)),
      });
    }

    return NextResponse.json({
      payments: formattedPayments,
      totalAtRisk,
      recoveredAmount,
      actionsCount,
      chartData
    }, { status: 200 });
  } catch (error) {
    console.error('[Payments API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment data' }, { status: 500 });
  }
}