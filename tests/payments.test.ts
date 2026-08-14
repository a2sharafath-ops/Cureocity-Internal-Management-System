import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import { verifyCheckoutSignature, verifyRazorpayWebhook } from "@/lib/payments/razorpay";
import { paymentStatus } from "@/lib/payments/config";
import { confirmRazorpayInvoice } from "@/lib/payments/confirmation";
import {
  capturedPaymentFromWebhook, persistOnlinePayment, validateCapturedPayment,
  type OnlinePaymentInvoice, type RazorpayPaymentEntity,
} from "@/lib/payments/settlement";

const invoice: OnlinePaymentInvoice = {
  id: "inv-1",
  status: "Unpaid",
  amount: 2500,
  gateway: "razorpay",
  gateway_order_id: "order_expected",
  gateway_order_amount: 250000,
  gateway_order_currency: "INR",
  gateway_payment_id: null,
};

const captured: RazorpayPaymentEntity = {
  id: "pay_1",
  order_id: "order_expected",
  amount: 250000,
  currency: "INR",
  status: "captured",
  captured: true,
};

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

describe("captured payment validation", () => {
  it("accepts only the invoice's stored order, amount, currency and captured status", () => {
    expect(validateCapturedPayment(invoice, captured)).toEqual({ ok: true });
    expect(validateCapturedPayment(invoice, { ...captured, order_id: "order_other" })).toEqual({
      ok: false, error: "Payment does not match this invoice's expected order.",
    });
    expect(validateCapturedPayment(invoice, { ...captured, amount: 249999 })).toEqual({
      ok: false, error: "Captured payment amount does not match the invoice.",
    });
    expect(validateCapturedPayment(invoice, { ...captured, currency: "USD" })).toEqual({
      ok: false, error: "Captured payment currency does not match the invoice.",
    });
    expect(validateCapturedPayment(invoice, { ...captured, status: "authorized", captured: false })).toEqual({
      ok: false, error: "Payment is not captured yet.",
    });
  });

  it("parses captured webhook entities and ignores unrelated events", () => {
    expect(capturedPaymentFromWebhook(JSON.stringify({ event: "payment.failed" }))).toEqual({ kind: "ignored" });
    expect(capturedPaymentFromWebhook("not-json")).toEqual({ kind: "invalid", error: "Invalid JSON." });
    expect(capturedPaymentFromWebhook(JSON.stringify({
      event: "payment.captured", payload: { payment: { entity: captured } },
    }))).toEqual({ kind: "captured", payment: captured });
  });
});

describe("checkout confirmation orchestration", () => {
  it("rejects a browser order that is not the invoice's expected order before verification", async () => {
    const verify = vi.fn();
    const persist = vi.fn();
    const result = await confirmRazorpayInvoice({
      invoice, submittedOrderId: "order_attacker", paymentId: captured.id,
      signature: "signed", actor: "Admin",
    }, { verify, persist });
    expect(result).toEqual({ ok: false, retryable: false, error: "Checkout order does not match this invoice." });
    expect(verify).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("uses the server-stored order for HMAC and refuses a fetched amount mismatch", async () => {
    const verify = vi.fn().mockReturnValue(true);
    const persist = vi.fn();
    const result = await confirmRazorpayInvoice({
      invoice, submittedOrderId: invoice.gateway_order_id!, paymentId: captured.id,
      signature: "signed", actor: "Admin",
    }, {
      verify,
      fetchPayment: vi.fn().mockResolvedValue({ ...captured, amount: 1 }),
      persist,
    });
    expect(verify).toHaveBeenCalledWith("order_expected", "pay_1", "signed");
    expect(result).toEqual({ ok: false, retryable: false, error: "Captured payment amount does not match the invoice." });
    expect(persist).not.toHaveBeenCalled();
  });

  it("propagates a retryable persistence failure after successful verification", async () => {
    const failure = { ok: false as const, retryable: true, error: "database unavailable" };
    const result = await confirmRazorpayInvoice({
      invoice, submittedOrderId: invoice.gateway_order_id!, paymentId: captured.id,
      signature: "signed", actor: "Admin",
    }, {
      verify: vi.fn().mockReturnValue(true),
      fetchPayment: vi.fn().mockResolvedValue(captured),
      persist: vi.fn().mockResolvedValue(failure),
    });
    expect(result).toEqual(failure);
  });

  it("treats the same already-settled payment as a replay without another API or DB call", async () => {
    const fetchPayment = vi.fn();
    const persist = vi.fn();
    const result = await confirmRazorpayInvoice({
      invoice: { ...invoice, status: "Paid", gateway_payment_id: captured.id },
      submittedOrderId: invoice.gateway_order_id!, paymentId: captured.id,
      signature: "signed", actor: "Admin",
    }, { verify: vi.fn().mockReturnValue(true), fetchPayment, persist });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.idempotent_replay).toBe(true);
    expect(fetchPayment).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});

describe("payment persistence RPC", () => {
  it("returns retryable failures for database errors and thrown connectivity failures", async () => {
    const dbError = await persistOnlinePayment({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "57014", message: "timeout" } }),
    }, invoice.id, captured, "Admin");
    expect(dbError).toEqual({
      ok: false, retryable: true,
      error: "Payment was verified but could not be persisted: timeout",
    });

    const unreachable = await persistOnlinePayment({
      rpc: vi.fn().mockRejectedValue(new Error("network down")),
    }, invoice.id, captured, "Admin");
    expect(unreachable).toEqual({
      ok: false, retryable: true,
      error: "Payment was verified but persistence could not be reached: network down",
    });
  });
});
