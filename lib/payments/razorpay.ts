import crypto from "crypto";

// Thin Razorpay client using the REST API (no SDK dependency). All functions
// assume credentials are present — callers must check paymentConfig().configured
// first. Kept isolated so a Stripe adapter can sit alongside later.

const API = "https://api.razorpay.com/v1";

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

/** Create an order. amountInMajor is rupees; Razorpay expects paise. */
export async function createRazorpayOrder(amountInMajor: number, receipt: string, notes?: Record<string, string>) {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      amount: Math.round(amountInMajor * 100),
      currency: "INR",
      receipt,
      notes: notes ?? {},
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order failed (${res.status}): ${text}`);
  }
  return (await res.json()) as { id: string; amount: number; currency: string; receipt: string; status: string };
}

/** Verify the webhook signature (X-Razorpay-Signature) against the raw body. */
export function verifyRazorpayWebhook(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Verify a client-side checkout success payload (order_id|payment_id + signature). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
