import os
import requests
import json
from dotenv import load_dotenv

load_dotenv('.env.local')

url = "http://localhost:3000/api/payment/create-order"
data = {
    "paymentId": "pay_mock_12345",
    "amount": 149900,
    "currency": "INR",
    "email": "demo@example.com",
    "phone": "+919876543210"
}
try:
    res = requests.post(url, json=data)
    print(res.status_code)
    print(res.text)
except Exception as e:
    print(e)
