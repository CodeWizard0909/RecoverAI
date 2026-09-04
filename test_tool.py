import os
import sys
sys.path.append('python-agent')
from agent import create_recovery_link

print(create_recovery_link('3a5244f9-e370-4cad-867c-12f688302bca', 75000, False, 'test'))
