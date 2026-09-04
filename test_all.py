import os
import requests
from dotenv import load_dotenv

load_dotenv('.env.local')
api_key = os.environ.get('GEMINI_API_KEY')

models = [
    'gemini-3.5-flash', 'gemini-3.5-flash-lite', 
    'gemini-3.1-flash-lite', 'gemini-3.7-flash', 
    'gemini-2.5-flash-lite', 'gemini-omni-1.1-flash',
    'gemini-flash-lite-latest'
]

for m in models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
    data = {"contents": [{"parts":[{"text": "hi"}]}]}
    try:
        res = requests.post(url, json=data)
        print(f"{m}: {res.status_code}")
    except Exception as e:
        print(f"{m}: ERROR {e}")
