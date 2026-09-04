import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('.env.local')
api_key = os.environ.get('GEMINI_API_KEY')

models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.0-pro'
]

data = {"contents": [{"parts":[{"text": "Hello"}]}]}

for m in models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
    print(f"Testing {m}...")
    success_count = 0
    for i in range(25):
        res = requests.post(url, json=data)
        if res.status_code == 200:
            success_count += 1
        elif res.status_code == 404:
            print(f"{m} is NOT FOUND (404)")
            break
        else:
            print(f"{m} failed at request {i+1} with {res.status_code}")
            err = res.json().get('error', {})
            print(err.get('message', 'No message'))
            break
    if success_count == 25:
        print(f"!!! FOUND IT: {m} successfully handled 25 requests! !!!")
        break
