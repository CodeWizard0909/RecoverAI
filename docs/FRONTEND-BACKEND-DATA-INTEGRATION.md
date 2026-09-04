# Fix for Frontend-Backend Data Integration Issue in RecoverAI

## Problem Description
The frontend display shows static/unresponsive behavior where visual indicators (such as "Link Generated" 🔗, "50% Option" 💰, etc.) do not update to reflect the actual state of the backend agent. Even after triggering the agent to process payments and generate links, the transaction queue continues to show the same initial state, making the indicators appear "static" and unresponsive to backend actions.

## Root Cause Analysis
The issue stems from a disconnect between the frontend display and the actual backend data source:

1. **Frontend Data Source**: The `fetchData()` function in `src/app/page.tsx` exclusively uses the mock endpoint:
   ```typescript
   const response = await fetch(`/api/demo/fetch-data?t=${Date.now()}`);
   ```

2. **Backend Agent Actions**: When the agent is triggered via `handleTrigger()` → `/api/agent/process-batch`, it:
   - Proxies the request to the real Python microservice
   - Processes payments using the autonomous agent loop
   - Updates the Supabase database with recovery actions (including links via `create_recovery_link`)
   - Stores reasoning with `| LINK: ...` and `| PARTIAL_LINK: ...` patterns

3. **The Disconnect**: Despite the backend agent successfully updating the database, the frontend continues to fetch and display **only mock data** from `/api/demo/fetch-data`, which does not reflect the real-time state of the database.

This creates the illusion that the frontend is "static" or unresponsive because:
- Mock data remains constant regardless of backend agent actions
- Visual indicators depend on data that never updates in the frontend's view
- The backend agent is working correctly, but its results are invisible to the frontend display

## Solution
Create a real data endpoint that fetches payment and recovery data from the Supabase database, and update the frontend to use this endpoint for display data.

### Step 1: Create Real Data Endpoint
Create `/src/app/api/payments/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    // Fetch payments with their latest recovery actions
    const { data: payments, error } = await supabaseAdmin
      .from('failed_payments')
      .select(`
        id,
        razorpay_payment_id,
        amount,
        currency,
        failure_reason,
        customer_email,
        customer_phone,
        status,
        recovery_actions (
          id,
          type,
          status,
          gemini_reasoning,
          executed_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format data for frontend consumption
    const formattedPayments = payments.map(payment => {
      // Extract latest recovery action
      const latestAction = payment.recovery_actions
        ?.sort((a, b) => 
          new Date(b.executed_at || 0).getTime() - 
          new Date(a.executed_at || 0).getTime()
        )[0] || null;

      return {
        id: payment.id,
        razorpay_payment_id: payment.razorpay_payment_id,
        amount: payment.amount,
        currency: payment.currency,
        failure_reason: payment.failure_reason,
        customer_email: payment.customer_email,
        customer_phone: payment.customer_phone,
        status: payment.status,
        recovery_actions: latestAction ? [{
          id: latestAction.id,
          type: latestAction.type,
          status: latestAction.status,
          gemini_reasoning: latestAction.gemini_reasoning || '',
          executed_at: latestAction.executed_at
        }] : []
      };
    });

    // Calculate stats
    let totalAtRisk = 0;
    let recoveredAmount = 0;
    let actionsCount = 0;

    payments.forEach(payment => {
      if (payment.status !== 'recovered') {
        totalAtRisk += payment.amount;
      } else {
        recoveredAmount += payment.amount;
      }
    });

    // Count executed recovery actions
    payments.forEach(payment => {
      if (payment.recovery_actions) {
        payment.recovery_actions.forEach(action => {
          if (action.status === 'executed') actionsCount++;
        });
      }
    });

    // Generate synthetic chart data (for demo consistency)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      chartData.push({
        time: `${i}h ago`,
        risk: Math.max(0, totalAtRisk - (i * 15000)),
        recovered: Math.max(0, recoveredAmount - (i * 8000)),
      });
    }

    return NextResponse.json({
      payments: formattedPayments,
      totalAtRisk,
      recoveredAmount,
      actionsCount,
      chartData
    }, { status: 200 });
  } catch (error) {
    console.error('[Payments API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment data' }, { status: 500 });
  }
}
```

### Step 2: Update Frontend to Use Real Data Endpoint
In `src/app/page.tsx`, update the `fetchData()` function (around line 126):

```typescript
const fetchData = async () => {
  try {
    // CHANGE THIS LINE:
    // FROM: const response = await fetch(`/api/demo/fetch-data?t=${Date.now()}`);
    // TO:
    const response = await fetch(`/api/payments`); // Remove timestamp param as not needed
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // UPDATE STATE WITH REAL DATA FORMAT:
    setPayments(data.payments);
    setTotalAtRisk(data.totalAtRisk);
    setRecoveredAmount(data.recoveredAmount);
    setActionsTaken(data.actionsCount);
    setChartData(data.chartData);
    
  } catch (e) {
    console.error('[Frontend] Data fetch error:', e);
    // Optional: fallback to mock data or show error state
  } finally {
    setLoading(false);
    setLastUpdated(new Date());
  }
};
```

### Step 3: Optional - Keep Mock Endpoints for Demo Flexibility
To maintain the ability to demonstrate with predefined scenarios:
1. Keep the existing mock endpoints (`/src/app/api/demo/*`)
2. Add a query parameter to switch between real and mock data:
   ```typescript
   // In fetchData():
   const useMock = false; // Set to true for mock data demo
   const endpoint = useMock ? '/api/demo/fetch-data' : '/api/payments';
   const response = await fetch(endpoint);
   ```
3. Or create a separate endpoint like `/api/demo/payments` for simulated scenarios

### Verification Steps
1. Start both frontend and backend agent:
   ```bash
   # In one terminal:
   cd python-agent && .\venv\Scripts\activate && uvicorn main:app --reload --port 8000
   
   # In another terminal:
   npm run dev
   ```
2. Click "① Simulate Failure" to inject test payment (uses mock endpoint)
3. Click "② Analyze & Plan" to trigger the real agent
4. Wait a few seconds for agent processing
5. Observe the transaction queue:
   - ✅ "Link Generated" 🔗 badge appears when agent creates a payment link
   - ✅ "50% Option" 💰 badge appears for partial payment offers
   - ✅ "⚠️ Escalated to Slack" badge appears for escalations
   - ✅ Indicators update dynamically as agent processes different payments
6. Test manual reset functionality (if implemented) to clear real data

### Impact
- **Eliminates Static Display**: Frontend now accurately reflects backend agent state in real-time
- **Enables Genuine Demo**: Judges can see the agent's actual work through updating visual indicators
- **Improves Credibility**: Demonstrates proper full-stack integration rather than mock-only presentation
- **Preserves Demo Flexibility**: Mock endpoints can still be used for controlled scenarios when needed
- **Zero Risk to Agent Logic**: Changes only affect data presentation, not the autonomous agent core

This fix ensures that the RecoverAI system demonstrates true end-to-end integration, where the frontend accurately reflects the backend agent's reasoning and actions—making visual indicators like "Link Generated" update dynamically rather than appearing static.