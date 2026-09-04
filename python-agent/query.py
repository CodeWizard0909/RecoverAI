import os
import sys
from dotenv import load_dotenv
load_dotenv('../.env.local')

import agent
print("EXECUTED:", agent.execute_recovery_actions())
