import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('.env.local')
api_key = os.environ.get('GEMINI_API_KEY')

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
data = {
    "contents": [{"parts":[{"text": "Hello"}]}]
}
for i in range(25):
    res = requests.post(url, json=data)
    if res.status_code != 200:
        print(f"Request {i+1} failed with {res.status_code}")
        print(json.dumps(res.json(), indent=2))
        break
    else:
        print(f"Request {i+1} OK")
