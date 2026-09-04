import os
import sys
sys.path.append('python-agent')
from dotenv import load_dotenv

load_dotenv('.env.local')
import agent

try:
    print(agent.create_recovery_link('cdc2f230-ded3-4661-baf6-f4db4c0b7a0b', 1499, True, 'test'))
except Exception as e:
    print("ERROR:", repr(e))
