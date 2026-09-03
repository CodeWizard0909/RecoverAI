import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/^"|"$/g, '')
);

async function check() {
  const { data: actions, error: fetchError } = await supabase
    .from('recovery_actions')
    .select(`*`);
  
  console.log("Error:", fetchError);
  console.log("Actions:", JSON.stringify(actions, null, 2));
}

check();
