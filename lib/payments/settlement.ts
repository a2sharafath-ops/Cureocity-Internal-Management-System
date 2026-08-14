import { ATOMIC_BILLING_MIGRATION } from "@/lib/billing-atomic";

export const ONLINE_PAYMENT_MIGRATION = "0180_harden_online_payments.sql";

export type OnlinePaymentInvoice = {
  id: string;
  status: string;
  amount: number;
  gateway: string | null;
  gateway_order_id: string | null;
  gateway_order_amount: number | null;
  gateway_order_currency: string | null;
  gateway_payment_id: string | null;
};

export type RazorpayPaymentEntity = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured?: boolean;
};

export type PaymentSettlement = {
  invoice_id: string;
  invoice_num: number | null;
  amount: number;
  status: string;
  idempotent_replay: boolean;
};

export type PaymentResult =
  | { ok: true; data: PaymentSettlement }
  | { ok: false; error: string; retryable: boolean };

type RpcError = { message: string; code?: string | null };
type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError | null }>;
};

export function expectedMinorAmount(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function validateCapturedPayment(
  invoice: OnlinePaymentInvoice,
  payment: RazorpayPaymentEntity,
): { ok: true } | { ok: false; error: string } {
  if (!invoice.gateway_order_id || invoice.gateway !== "razorpay") {
    return { ok: false, error: "Invoice has no expected Razorpay order." };
  }
  if (payment.order_id !== invoice.gateway_order_id) {
    return { ok: false, error: "Payment does not match this invoice's expected order." };
  }
  if (payment.status !== "captured" || payment.captured === false) {
    return { ok: false, error: "Payment is not captured yet." };
  }
  const expected = expectedMinorAmount(invoice.amount);
  if (invoice.gateway_order_amount == null || invoice.gateway_order_amount !== expected) {
    return { ok: false, error: "Invoice order amount metadata is missing or stale." };
  }
  if (payment.amount !== expected) {
    return { ok: false, error: "Captured payment amount does not match the invoice." };
  }
  const expectedCurrency = (invoice.gateway_order_currency ?? "").toUpperCase();
  if (!expectedCurrency || payment.currency.toUpperCase() !== expectedCurrency || expectedCurrency !== "INR") {
    return { ok: false, error: "Captured payment currency does not match the invoice." };
  }
  return { ok: true };
}

export async function persistOnlinePayment(
  client: RpcClient,
  invoiceId: string,
  payment: RazorpayPaymentEntity,
  actor: string,
): Promise<PaymentResult> {
  let response: { data: unknown; error: RpcError | null };
  try {
    response = await client.rpc("settle_online_invoice_atomic", {
      p_invoice_id: invoiceId,
      p_order_id: payment.order_id,
      p_payment_id: payment.id,
      p_amount_minor: payment.amount,
      p_currency: payment.currency,
      p_actor: actor,
    });
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      error: `Payment was verified but persistence could not be reached: ${error instanceof Error ? error.message : "unknown database error"}`,
    };
  }
  const { data, error } = response;
  if (error) {
    const missing = error.code === "PGRST202" || error.code === "42883"
      || /function .* does not exist|schema cache/i.test(error.message);
    const rejected = error.code === "23505"
      || /not eligible|does not match|already attached|lacks hardened amount metadata/i.test(error.message);
    return {
      ok: false,
      retryable: !rejected,
      error: missing
        ? `Online payment persistence requires ${ATOMIC_BILLING_MIGRATION} and ${ONLINE_PAYMENT_MIGRATION} in this environment.`
        : `Payment was verified but could not be persisted: ${error.message}`,
    };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, retryable: true, error: "Payment persistence returned no result." };
  }
  return { ok: true, data: data as PaymentSettlement };
}

type RazorpayWebhook = {
  event?: string;
  payload?: { payment?: { entity?: Partial<RazorpayPaymentEntity> } };
};

export function capturedPaymentFromWebhook(raw: string):
  | { kind: "ignored" }
  | { kind: "invalid"; error: string }
  | { kind: "captured"; payment: RazorpayPaymentEntity } {
  let event: RazorpayWebhook;
  try {
    event = JSON.parse(raw) as RazorpayWebhook;
  } catch {
    return { kind: "invalid", error: "Invalid JSON." };
  }
  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    return { kind: "ignored" };
  }
  const payment = event.payload?.payment?.entity;
  if (!payment || typeof payment.id !== "string" || typeof payment.order_id !== "string"
      || typeof payment.amount !== "number" || !Number.isInteger(payment.amount)
      || payment.amount < 0 || typeof payment.currency !== "string"
      || payment.status !== "captured") {
    return { kind: "invalid", error: "Captured payment event is missing required fields." };
  }
  return { kind: "captured", payment: payment as RazorpayPaymentEntity };
}
