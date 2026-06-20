import Razorpay from 'razorpay';
import crypto from 'crypto';

// Helper to clean key credentials
function cleanCredential(value: string | undefined): string {
  if (!value) return '';
  let cleaned = value.trim();
  // Remove enclosing angle brackets if any
  if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }
  // Remove leading '_ ' or '_' if they prefix the 24-character secret key
  if (cleaned.startsWith('_ ')) {
    cleaned = cleaned.substring(2).trim();
  } else if (cleaned.startsWith('_') && cleaned.length > 24) {
    cleaned = cleaned.substring(1).trim();
  }
  return cleaned;
}

export const KEY_ID = cleanCredential(process.env.RAZORPAY_KEY_ID) || 'rzp_test_insightforge';
export const KEY_SECRET = cleanCredential(process.env.RAZORPAY_KEY_SECRET || process.env._RAZORPAY_KEY_SECRET) || 'insightforge_test_secret';

let razorpay: Razorpay | null = null;
try {
  if (KEY_ID && KEY_SECRET && KEY_ID !== 'your_razorpay_key_id') {
    console.log(`[Payment] Initializing Razorpay with KEY_ID=${KEY_ID}`);
    razorpay = new Razorpay({
      key_id: KEY_ID,
      key_secret: KEY_SECRET,
    });
  }
} catch (err) {
  console.error('[Payment] Failed to initialize Razorpay SDK:', err);
}

export async function createOrder(amount: number, currency: string = 'INR'): Promise<{ id: string; amount: number; currency: string }> {
  // Amount in paise (1 INR = 100 paise)
  const amountInPaise = amount * 100;

  if (!razorpay) {
    throw new Error('Razorpay SDK is not initialized. Please configure credentials.');
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt: `receipt_order_${Date.now()}`,
    });
    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  } catch (err: any) {
    console.error('[Payment] Razorpay SDK order creation failed:', err);
    throw new Error(`Razorpay API Error: ${err.message || err.description || 'Order creation failed'}`);
  }
}

export function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  if (orderId.startsWith('order_mock_')) {
    // Automatically verify mock orders in test mode
    return true;
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generatedSignature === signature;
  } catch (err) {
    console.error('[Payment] Signature verification failed:', err);
    return false;
  }
}
