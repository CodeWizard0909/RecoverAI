import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env.local')
supabase = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
res = supabase.table('failed_payments').select('id, amount').limit(1).execute()
if res.data:
    p_id = res.data[0]['id']
    amount = res.data[0]['amount']
    import sys
    sys.path.append('python-agent')
    from agent import create_recovery_link
    print("Testing with ID:", p_id)
    print(create_recovery_link(p_id, amount, False, 'test'))
else:
    print("No payments found")
