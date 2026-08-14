import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  paymentConfig: vi.fn(),
  verifyWebhook: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/payments/config", () => ({ paymentConfig: mocks.paymentConfig }));
vi.mock("@/lib/payments/razorpay", () => ({ verifyRazorpayWebhook: mocks.verifyWebhook }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/payments/webhook/route";

const payment = {
  id: "pay_1", order_id: "order_1", amount: 250000,
  currency: "INR", status: "captured", captured: true,
};
const invoice = {
  id: "inv-1", status: "Unpaid", amount: 2500,
  gateway: "razorpay", gateway_order_id: "order_1",
  gateway_order_amount: 250000, gateway_order_currency: "INR",
  gateway_payment_id: null,
};

function request(body = JSON.stringify({
  event: "payment.captured", payload: { payment: { entity: payment } },
})) {
  return new Request("http://localhost/api/payments/webhook", {
    method: "POST", body, headers: { "x-razorpay-signature": "signed" },
  });
}

function adminClient(options: {
  invoice?: typeof invoice | null;
  invoiceError?: { message: string } | null;
  rpcData?: Record<string, unknown> | null;
  rpcError?: { code?: string; message: string } | null;
} = {}) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({
    data: options.invoice === undefined ? invoice : options.invoice,
    error: options.invoiceError ?? null,
  });
  const admin = {
    from: vi.fn(() => query),
    rpc: vi.fn().mockResolvedValue({
      data: options.rpcData ?? {
        invoice_id: "inv-1", invoice_num: 1, amount: 2500,
        status: "Paid", idempotent_replay: false,
      },
      error: options.rpcError ?? null,
    }),
  };
  mocks.createAdminClient.mockReturnValue(admin);
  return admin;
}

describe("Razorpay payment webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.paymentConfig.mockReturnValue({ configured: true, provider: "razorpay" });
    mocks.verifyWebhook.mockReturnValue(true);
  });

  it("rejects a bad signature before touching the database", async () => {
    mocks.verifyWebhook.mockReturnValue(false);
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("validates and atomically persists a captured payment", async () => {
    const admin = adminClient();
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, idempotent: false });
    expect(admin.rpc).toHaveBeenCalledWith("settle_online_invoice_atomic", {
      p_invoice_id: "inv-1", p_order_id: "order_1", p_payment_id: "pay_1",
      p_amount_minor: 250000, p_currency: "INR", p_actor: "Razorpay webhook",
    });
  });

  it("refuses a signed amount mismatch without calling settlement", async () => {
    const admin = adminClient();
    const response = await POST(request(JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { ...payment, amount: 1 } } },
    })));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, retryable: false, reason: "payment-mismatch" });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 so Razorpay retries when invoice persistence fails", async () => {
    adminClient({ rpcError: { code: "57014", message: "database timeout" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, retryable: true, reason: "persistence-failed" });
  });

  it("acknowledges exact idempotent replays and unknown orders", async () => {
    adminClient({ rpcData: {
      invoice_id: "inv-1", invoice_num: 1, amount: 2500,
      status: "Paid", idempotent_replay: true,
    } });
    const replay = await POST(request());
    expect(await replay.json()).toEqual({ ok: true, idempotent: true });

    adminClient({ invoice: null });
    const unknown = await POST(request());
    expect(await unknown.json()).toEqual({ ok: true, ignored: true, reason: "unknown-order" });
  });

  it("returns a retryable 503 when the invoice read fails", async () => {
    adminClient({ invoiceError: { message: "read timeout" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, retryable: true, reason: "invoice-read-failed" });
  });
});
