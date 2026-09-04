import os
import razorpay
from dotenv import load_dotenv

load_dotenv('.env.local')
rzp_client = razorpay.Client(auth=(os.environ['RAZORPAY_KEY_ID'], os.environ['RAZORPAY_KEY_SECRET']))
print(dir(rzp_client))
