import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env.local')
supabase = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

try:
    res = supabase.table('recovery_actions').insert({
        'payment_id': '3a5244f9-e370-4cad-867c-12f688302bca',
        'type': 'escalate',
        'status': 'executed',
        'gemini_reasoning': 'test reasoning'
    }).execute()
    print("Success:", res)
except Exception as e:
    print("Error:", repr(e))
