/**
 * Verification Harness for The AI Brain (Slice 03)
 * 
 * Simulates triggering the batch processing agent.
 * The test defines "correct" as: 
 * 1. The API route returns a 200 OK.
 * 2. It returns a JSON summary of processed records.
 * 
 * Prerequisite: You must have at least one `pending_analysis` payment in Supabase.
 * (Running `npx tsx tests/simulate_webhook.ts` will create one).
 */

const ENDPOINT = 'http://localhost:3000/api/agent/process-batch';

async function runTest() {
  console.log(`[TEST] Triggering AI Batch Processor at ${ENDPOINT}...`);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ [PASS] Agent batch process successful.');
      console.log('📊 Result:', JSON.stringify(data, null, 2));
      console.log('👉 Next step: Check your Supabase `recovery_actions` table to see what Gemini decided!');
    } else {
      console.error(`❌ [FAIL] Server returned ${response.status}: ${await response.text()}`);
    }
  } catch (err) {
    console.error('❌ [ERROR] Could not connect to the local server. Is it running?', err);
  }
}

runTest();
