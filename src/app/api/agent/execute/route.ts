import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST() {
  try {
    // Proxy to Python Background Agent
    const pythonAgentUrl = process.env.PYTHON_AGENT_URL || 'http://127.0.0.1:8000';
    try {
      const response = await fetch(`${pythonAgentUrl}/trigger`, { method: 'POST' });
      if (!response.ok) {
        throw new Error('Python agent returned ' + response.status);
      }
      const data = await response.json();
      return NextResponse.json({ 
        message: 'Execution delegated to Python microservice.', 
        executed: data.executed_by_agent 
      }, { status: 200 });
    } catch (e) {
      console.error('[NextJS] Failed to proxy to Python agent:', e);
      return NextResponse.json({ error: 'Failed to contact Python agent. Make sure it is running on port 8000.' }, { status: 500 });
    }

  } catch (error) {
    console.error('[Executor] Unhandled Exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
