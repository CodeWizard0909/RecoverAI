import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { paymentId } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
    }

    // Since Razorpay webhooks can't hit localhost, this local endpoint manually
    // marks the original payment as recovered in the database upon successful checkout.
    const { error } = await supabaseAdmin
      .from('failed_payments')
      .update({ status: 'recovered' })
      .eq('id', paymentId);

    if (error) {
      console.error('[Simulate Success] DB Update Error:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Simulate Success]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
