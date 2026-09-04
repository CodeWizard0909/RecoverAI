@echo off
echo Starting RecoverAI Python Agent...
cd python-agent
call venv\Scripts\activate
uvicorn main:app --reload --port 8000
