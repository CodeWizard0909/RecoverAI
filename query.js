const fs = require('fs'); 
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => { 
  const i = l.indexOf('='); 
  return [l.slice(0, i).trim(), l.slice(i+1).replace(/^\"|\"$/g, '').replace('\r','').trim()]; 
})); 
const { createClient } = require('@supabase/supabase-js'); 
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY); 
async function run() { 
  const res = await supabase.from('recovery_actions').select('*, failed_payments(*)').eq('status', 'pending'); 
  console.log(JSON.stringify(res, null, 2)); 
} 
run();
