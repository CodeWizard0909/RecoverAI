export {};
/**
 * Verification Harness for The Execution Layer (Slice 04)
 * 
 * Simulates triggering the execution batch processor.
 * 
 * Prerequisite: You must have at least one `pending` action in `recovery_actions`.
 * (Running `simulate_webhook.ts` -> `simulate_batch_agent.ts` sets this up).
 */

const ENDPOINT = 'http://localhost:3000/api/agent/execute';

async function runTest() {
  console.log(`[TEST] Triggering Execution Batch Processor at ${ENDPOINT}...`);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ [PASS] Executor batch process successful.');
      console.log('📊 Result:', JSON.stringify(data, null, 2));
      console.log('👉 Next step: Check Razorpay dashboard to see the generated Payment Link!');
    } else {
      console.error(`❌ [FAIL] Server returned ${response.status}: ${await response.text()}`);
    }
  } catch (err) {
    console.error('❌ [ERROR] Could not connect to the local server. Is it running?', err);
  }
}

runTest();
