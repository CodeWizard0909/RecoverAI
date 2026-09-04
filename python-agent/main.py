import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Configure basic logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

import sys
import os
from pathlib import Path

# Ensure the python-agent directory is in sys.path so 'import agent' works from anywhere
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

# Import after configuring logging and paths
import agent

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting RecoverAI Background Agent...")
    
    # Schedule the Brain (process_pending_failures) to run every 1 minute
    scheduler.add_job(
        agent.process_pending_failures,
        trigger=IntervalTrigger(minutes=1),
        id="process_brain",
        name="Process Pending Failures",
        replace_existing=True,
        max_instances=1
    )
    
    # Schedule the Executor to run every 1 minute
    scheduler.add_job(
        agent.execute_recovery_actions,
        trigger=IntervalTrigger(minutes=1),
        id="execute_actions",
        name="Execute Recovery Actions",
        replace_existing=True,
        max_instances=1
    )
    
    scheduler.start()
    logger.info("APScheduler started. Autonomous loops active.")
    yield
    # Shutdown
    logger.info("Shutting down background agent...")
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan, title="RecoverAI Background Agent")

@app.get("/health")
def health_check():
    return {"status": "ok", "agent": "active"}

@app.post("/trigger")
def manual_trigger():
    """Manual override to trigger batch processing immediately for the demo."""
    brain_count = agent.process_pending_failures()
    exec_count = agent.execute_recovery_actions()
    return {
        "status": "success",
        "processed_by_brain": brain_count,
        "executed_by_agent": exec_count
    }
