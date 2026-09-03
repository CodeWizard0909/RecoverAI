import Razorpay from 'razorpay';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.warn('WARNING: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set.');
}

// Instantiate Razorpay using the keys. If they are missing, it will throw an error when used, 
// which our execution logic will gracefully catch.
export const razorpayClient = new Razorpay({
  key_id: keyId || 'dummy_key',
  key_secret: keySecret || 'dummy_secret',
});
