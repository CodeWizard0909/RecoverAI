# RecoverAI Buildathon - Implementation Guidance

This document provides step-by-step instructions for implementing the minor observations from the REPORT.md file. Follow these guides to enhance your demo presentation without risking core functionality.

## Table of Contents
1. [Manual Reset Button](#1-manual-reset-button)
2. [Enhanced Agent Logging](#2-enhanced-agent-logging)
3. [Demo Endpoint Organization](#3-demo-endpoint-organization)
4. [Edge Case Simulation (Optional)](#4-edge-case-simulation-optional)

---

## 1. Manual Reset Button

### Step 1: Create Backend Endpoint
Create `/src/app/api/demo/reset/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST() {
  try {
    // Clear test data - adjust tables as needed for your schema
    await supabaseAdmin.from('failed_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('recovery_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    return NextResponse.json({ message: 'Demo state reset successfully' }, { status: 200 });
  } catch (error) {
    console.error('[Demo Reset] Error:', error);
    return NextResponse.json({ error: 'Failed to reset demo state' }, { status: 500 });
  }
}
```

### Step 2: Add Frontend Button
In `src/app/page.tsx`, add inside the navbar flex container (around line 226):

```typescript
<div className="flex items-center gap-2">
  <span className="w-5 h-5 bg-gray-600/20 rounded-full flex items-center justify-center text-gray-400 text-xs font-bold border border-gray-500/30 shadow-lg">3</span>
  <button 
    onClick={handleResetDemo}
    className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gray-500 hover:bg-gray-600 text-gray-100 transition-all flex items-center gap-2"
  >
    <RefreshCw className="w-4 h-4" /> Reset Demo
  </button>
</div>
```

### Step 3: Implement Handler Function
Add near other handler functions (around line 168):

```typescript
const handleResetDemo = async () => {
  try {
    const response = await fetch(`/api/demo/reset`, { method: 'POST' });
    if (!response.ok) {
      throw new Error('Reset failed');
    }
    await fetchData(); // Refresh UI with clean state
    alert('Demo state has been reset!');
  } catch (e) {
    console.error('Reset error:', e);
    alert('Failed to reset demo state. Check console for details.');
  }
};
```

### Step 4: Test
1. Run `npm run dev`
2. Inject some test data with "① Simulate Failure"
3. Click the new "Reset Demo" button
4. Verify UI returns to empty state with "All revenue recovered." message

---

## 2. Enhanced Agent Logging

### Step 1: Modify process_pending_failures
In `python-agent/agent.py`, find the `process_pending_failures()` function (around line 154) and enhance the logging inside the payment processing loop:

```python
success_count = 0
for payment in payments:
    try:
        existing = supabase.table('recovery_actions').select('id', count='exact').eq('payment_id', payment['id']).execute()
        if existing.count and existing.count > 0:
            supabase.table('failed_payments').update({'status': 'recovery_in_progress'}).eq('id', payment['id']).execute()
            continue

        logger.info(f"🤖 [Agent] Starting reasoning loop for payment {payment['id']}")
        
        # ... [existing system_instruction and chat setup] ...

        response = chat.send_message(system_instruction)
        
        max_turns = 3
        for turn in range(max_turns):
            if not response.function_calls:
                break
                
            for fn in response.function_calls:
                logger.info(f"🛠️ [Agent] Executing tool: {fn.name}")
                
                # Execute tool with validation error handling
                result = None
                try:
                    if fn.name == 'get_customer_context':
                        result = get_customer_context(**fn.args)
                    elif fn.name == 'escalate_to_human':
                        result = escalate_to_human(**fn.args)
                    elif fn.name == 'create_recovery_link':
                        result = create_recovery_link(**fn.args)
                    else:
                        result = f"Error: Unknown function {fn.name}"
                except ValidationError as ve:
                    logger.warning(f"⚠️ [Agent] Pydantic Validation Error in {fn.name}: {ve}")
                    result = f"ValidationError: {ve}"
                except Exception as e:
                    logger.error(f"⚠️ [Agent] Execution Error in {fn.name}: {e}")
                    result = f"ExecutionError: {e}"
                    
                # Log the result briefly for debugging
                logger.info(f"📝 [Agent] Tool {fn.name} result: {str(result)[:100]}...")
                
                response = chat.send_message(
                    types.Part.from_function_response(
                        name=fn.name,
                        response={"result": result}
                    )
                )
        
        # Log final decision after tool calling loop
        logger.info(f"🎯 [Agent] Completed reasoning for payment {payment['id']}")
        
        success_count += 1
    except Exception as e:
        logger.error(f"[Agent] Failed to process payment {payment['id']}: {e}")
```

### Step 2: Test Logging
1. Start the Python agent: `cd python-agent && .\venv\Scripts\activate && uvicorn main:app --reload --port 8000`
2. Start frontend: `npm run dev`
3. Trigger agent with "② Analyze & Plan"
4. Observe detailed logs in the Python agent terminal showing:
   - Tool selections
   - Reasoning snippets
   - Results

---

## 3. Demo Endpoint Organization

### Step 1: Move Files
Move the demo API files:
```
FROM: src/app/api/demo/fetch-data/route.ts
      src/app/api/demo/inject/route.ts
TO:   src/app/api/demo/fetch-data/route.ts
      src/app/api/demo/inject/route.ts
```
*(They're likely already in the correct location - just verify)*

### Step 2: Create Demo Index File
Create `src/app/api/demo/route.ts` to group endpoints:

```typescript
// This file serves as an index for demo endpoints
// Individual endpoints are in their respective subdirectories:
// - fetch-data/route.ts
// - inject/route.ts
// - reset/route.ts (if implemented)
// - webhooks/razorpay/route.ts remains in webhooks/ as it's production-bound
```

### Step 3: Update Frontend References
In `src/app/page.tsx`, update all fetch URLs to include `/demo/` prefix:

- Line 133: Change `/api/demo/fetch-data` → `/api/demo/fetch-data` (no change if already correct)
- Line 175: Change `/api/demo/inject` → `/api/demo/inject` (no change if already correct)
- Add for reset: `/api/demo/reset`

**Example updates:**
```typescript
// Fetch data
const response = await fetch(`/api/demo/fetch-data?t=${Date.now()}`);

// Inject failures
await fetch('/api/demo/inject', { method: 'POST' });

// Reset demo
await fetch('/api/demo/reset', { method: 'POST' });
```

### Step 4: Update Python Microservice Config (if needed)
If your Python agent reads `PYTHON_AGENT_URL` from environment, no change needed as it's just a hostname/port.

If you have hardcoded paths, update them to include `/demo/` prefix where appropriate.

### Step 5: Test
1. Run both frontend and backend
2. Verify all demo functions work:
   - Inject failures
   - Trigger agent
   - Reset demo
   - View updated data

---

## 4. Edge Case Simulation (Optional)

### Step 1: Enhance fetch-data Endpoint
Modify `src/app/api/demo/fetch-data/route.ts` to accept scenario parameters:

```typescript
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scenario = searchParams.get('scenario') || 'normal';
    
    // Simulate different scenarios
    switch (scenario) {
      case 'timeout':
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 5000));
        return NextResponse.json({ payments: [], actionsCount: 0 }, { status: 200 });
        
      case 'empty':
        return NextResponse.json({ payments: [], actionsCount: 0 }, { status: 200 });
        
      case 'error':
        return NextResponse.json({ error: 'Simulated service error' }, { status: 500 });
        
      case 'malformed':
        return new NextResponse('Invalid JSON response', { status: 500 });
        
      default: // normal
        // Your existing mock data logic
        const mockData = {
          payments: [
            {
              id: 'pay_demo_1',
              razorpay_payment_id: 'rzp_demo_1',
              amount: 250000, // ₹2,500
              currency: 'INR',
              failure_reason: 'Network timeout',
              customer_email: 'vip@example.com',
              customer_phone: '9999999999',
              status: 'pending_analysis',
              recovery_actions: []
            }
          ],
          actionsCount: 1
        };
        return NextResponse.json(mockData, { status: 200 });
    }
  } catch (error) {
    console.error('[Demo Fetch Data] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

### Step 2: Update Frontend to Use Scenarios
Create a scenario selector in your UI (optional for demo):

```typescript
// Add to your UI controls
<select 
  onChange={e => setDemoScenario(e.target.value)}
  value={demoScenario}
  className="bg-gray-800 border-gray-600 text-gray-100 rounded px-3 py-1"
>
  <option value="normal">Normal</option>
  <option value="timeout">Timeout</option>
  <option value="empty">Empty State</option>
  <option value="error">Service Error</option>
  <option value="malformed">Malformed Response</option>
</select>
```

Then modify fetchData to use the scenario:

```typescript
const fetchData = async () => {
  try {
    const url = `/api/demo/fetch-data?t=${Date.now()}${demoScenario ? `&scenario=${demoScenario}` : ''}`;
    const response = await fetch(url);
    // ... rest unchanged
  } catch (e) {
    // ... error handling
  }
};
```

### Step 3: Test Scenarios
1. Set scenario to "timeout" - verify 5-second delay
2. Set scenario to "error" - verify error handling in UI
3. Set scenario to "empty" - verify empty state message
4. Return to "normal" for standard demo flow

## Verification Checklist

After implementing any of these enhancements, verify:

### For Reset Button:
- [ ] Button appears in navbar
- [ ] Clicking clears test data
- [ ] UI returns to clean state
- [ ] No errors in console

### For Enhanced Logging:
- [ ] Python agent terminal shows detailed logs
- [ ] Tool selections are logged
- [ ] Strategy reasoning snippets appear
- [ ] No sensitive data leaked in logs

### For Demo Organization:
- [ ] All demo endpoints accessible via `/demo/` path
- [ ] No 404 errors on demo functionality
- [ ] Code structure clearly separates demo/production

### For Edge Cases (if implemented):
- [ ] Scenario selector appears in UI
- [ ] Each scenario behaves as expected
- [ ] Normal scenario works for standard demo
- [ ] Error handling functions correctly

## Risk Mitigation

Before implementing any changes:
1. **Backup current working state** (copy your project folder)
2. **Implement one change at a time**
3. **Test thoroughly** after each implementation
4. **Keep the core agent logic unchanged** - these are purely additive/demo enhancements
5. **Have a rollback plan** - if something breaks, you can revert to backup

## Final Recommendation

Focus on **#1 (Reset Button)** and **#2 (Enhanced Logging)** first - they provide the highest demo value with lowest risk. Implement these, get a good night's sleep, and walk into the Buildathon knowing your presentation will be smooth, professional, and technically impressive.

You've built an exceptional system - now let's make sure the judges experience it at its best. 🚀