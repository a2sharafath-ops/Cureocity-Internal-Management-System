// Payment gateway configuration. The whole payment layer is a *key-ready
// scaffold*: it stays inert until the relevant environment variables are set,
// so nothing breaks in dev/prod before you have credentials.
//
// To activate (later), set these in Vercel / .env.local:
//   PAYMENT_PROVIDER=razorpay            # or "stripe"
//   RAZORPAY_KEY_ID=rzp_live_xxx
//   RAZORPAY_KEY_SECRET=xxx
//   RAZORPAY_WEBHOOK_SECRET=xxx          # for the /api/payments/webhook route
// (Stripe equivalents: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)

export type PaymentProvider = "razorpay" | "stripe" | "none";

export function paymentProvider(): PaymentProvider {
  const p = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  if (p === "razorpay" || p === "stripe") return p;
  return "none";
}

export function paymentConfig() {
  const provider = paymentProvider();
  const razorpayReady = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const configured =
    (provider === "razorpay" && razorpayReady) ||
    (provider === "stripe" && stripeReady);
  return {
    provider,
    configured,
    // safe to expose to the client for checkout.js
    publicKeyId: provider === "razorpay" ? (process.env.RAZORPAY_KEY_ID ?? null) : null,
    currency: "INR",
  };
}

/** Small serializable summary for UI (never leaks secrets). */
export function paymentStatus() {
  const { provider, configured, currency } = paymentConfig();
  return { provider, configured, currency };
}
