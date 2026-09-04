import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST() {
  try {
    // Clear test data
    await supabaseAdmin.from('recovery_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('failed_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    return NextResponse.json({ message: 'Demo state reset successfully' }, { status: 200 });
  } catch (error) {
    console.error('[Demo Reset] Error:', error);
    return NextResponse.json({ error: 'Failed to reset demo state' }, { status: 500 });
  }
}
