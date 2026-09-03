import { GoogleGenAI, Type } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not set. The AI Agent will fail.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export interface RecoveryStrategy {
  action: 'retry_upi' | 'send_link' | 'schedule_retry' | 'escalate';
  reasoning: string;
}

/**
 * Calls Gemini to determine the best recovery strategy for a failed payment.
 */
export async function determineRecoveryStrategy(
  amount: number,
  currency: string,
  failureReason: string
): Promise<RecoveryStrategy> {
  const prompt = `
You are an autonomous revenue recovery agent.
A payment has failed. Analyze the failure reason and determine the best recovery action.

Failure Details:
- Amount: ${amount / 100} ${currency}
- Reason provided by gateway: "${failureReason}"

Available Actions:
1. retry_upi: Use when it's a temporary network drop or UPI timeout.
2. send_link: Use when the card expired, or the user needs to enter new payment details.
3. schedule_retry: Use for insufficient funds (retry in a few days).
4. escalate: Use for large amounts with unknown/hard errors requiring human intervention.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              enum: ['retry_upi', 'send_link', 'schedule_retry', 'escalate'],
              description: 'The chosen recovery action'
            },
            reasoning: {
              type: Type.STRING,
              description: 'A short explanation of why this action was chosen'
            }
          },
          required: ['action', 'reasoning']
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini returned an empty response.');
    }

    const strategy = JSON.parse(responseText) as RecoveryStrategy;
    return strategy;
  } catch (error) {
    console.error('[AI Agent] Failed to determine strategy:', error);
    throw error;
  }
}
