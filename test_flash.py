import os
from google import genai
from dotenv import load_dotenv
load_dotenv('.env.local')
client = genai.Client(api_key=os.environ.get('GEMINI_API_KEY'))
for m in ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']:
    try:
        print(f"Testing {m}...")
        res = client.models.generate_content(model=m, contents='test')
        print(f"{m} SUCCESS!")
    except Exception as e:
        print(f"{m} FAILED: {e}")
