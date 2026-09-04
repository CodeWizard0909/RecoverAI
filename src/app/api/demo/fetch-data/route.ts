import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Quick helper to fetch joined data for the UI
export async function GET() {
  try {
    const { data: payments, error } = await supabaseAdmin
      .from('failed_payments')
      .select(`
        *,
        recovery_actions (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { count: actionsCount, error: countErr } = await supabaseAdmin
      .from('recovery_actions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'executed');
    
    if (countErr) throw countErr;

    return NextResponse.json({
      payments: payments || [],
      actionsCount: actionsCount || 0
    });
  } catch (error) {
    console.error('[Fetch Data]', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
