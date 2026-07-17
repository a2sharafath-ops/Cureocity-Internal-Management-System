import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { verifyCheckoutSignature, verifyRazorpayWebhook } from "@/lib/payments/razorpay";
import { paymentStatus } from "@/lib/payments/config";

describe("razorpay signature verification", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = "hook_secret";
  });

  it("accepts a correctly-signed checkout payload", () => {
    const orderId = "order_123";
    const paymentId = "pay_456";
    const sig = crypto.createHmac("sha256", "test_secret").update(`${orderId}|${paymentId}`).digest("hex");
    expect(verifyCheckoutSignature(orderId, paymentId, sig)).toBe(true);
  });

  it("rejects a tampered checkout signature", () => {
    expect(verifyCheckoutSignature("order_123", "pay_456", "deadbeef")).toBe(false);
  });

  it("verifies webhook body HMAC", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const sig = crypto.createHmac("sha256", "hook_secret").update(body).digest("hex");
    expect(verifyRazorpayWebhook(body, sig)).toBe(true);
    expect(verifyRazorpayWebhook(body, "bad")).toBe(false);
    expect(verifyRazorpayWebhook(body, null)).toBe(false);
  });
});

describe("paymentStatus", () => {
  it("reports not-configured when no provider env is set", () => {
    delete process.env.PAYMENT_PROVIDER;
    const s = paymentStatus();
    expect(s.configured).toBe(false);
    expect(s.provider).toBe("none");
  });
});
