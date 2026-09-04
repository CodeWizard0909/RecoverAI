import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('.env.local')
api_key = os.environ.get('GEMINI_API_KEY')

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
data = {
    "contents": [{"parts":[{"text": "Hello"}]}]
}
res = requests.post(url, json=data)
print(res.status_code)
print(json.dumps(res.json(), indent=2))
