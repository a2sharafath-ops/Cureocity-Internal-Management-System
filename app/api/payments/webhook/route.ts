import { NextResponse } from "next/server";
import { paymentConfig } from "@/lib/payments/config";
import { verifyRazorpayWebhook } from "@/lib/payments/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  capturedPaymentFromWebhook, persistOnlinePayment, validateCapturedPayment,
  type OnlinePaymentInvoice,
} from "@/lib/payments/settlement";

export const dynamic = "force-dynamic";

// Gateway webhook (server-to-server). Inert until the provider + webhook secret
// are configured. Configure the endpoint in the gateway dashboard as:
//   https://<your-domain>/api/payments/webhook
export async function POST(req: Request) {
  const cfg = paymentConfig();
  if (!cfg.configured) {
    return NextResponse.json({ ok: false, reason: "payments-not-configured" }, { status: 200 });
  }

  const raw = await req.text();

  if (cfg.provider === "razorpay") {
    const signature = req.headers.get("x-razorpay-signature");
    if (!verifyRazorpayWebhook(raw, signature)) {
      return NextResponse.json({ ok: false, reason: "bad-signature" }, { status: 400 });
    }
    const parsed = capturedPaymentFromWebhook(raw);
    if (parsed.kind === "invalid") {
      return NextResponse.json({ ok: false, reason: "invalid-event", detail: parsed.error }, { status: 400 });
    }
    if (parsed.kind === "ignored") {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    // Service-role: webhooks have no user session. First resolve the invoice by
    // its server-stored order and validate the signed amount/currency/status.
    const admin = createAdminClient();
    const { data: invoiceData, error: invoiceError } = await admin.from("invoices")
      .select("id, status, amount, gateway, gateway_order_id, gateway_order_amount, gateway_order_currency, gateway_payment_id")
      .eq("gateway_order_id", parsed.payment.order_id).maybeSingle();
    if (invoiceError) {
      return NextResponse.json({ ok: false, retryable: true, reason: "invoice-read-failed" }, { status: 503 });
    }
    if (!invoiceData) {
      // The Razorpay account may serve another application. It is authenticated
      // but not ours, so acknowledge without mutating or inviting endless retry.
      return NextResponse.json({ ok: true, ignored: true, reason: "unknown-order" }, { status: 200 });
    }
    const invoice = invoiceData as OnlinePaymentInvoice;
    const validation = validateCapturedPayment(invoice, parsed.payment);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, retryable: false, reason: "payment-mismatch" }, { status: 409 });
    }
    const persisted = await persistOnlinePayment(admin, invoice.id, parsed.payment, "Razorpay webhook");
    if (!persisted.ok) {
      return NextResponse.json(
        { ok: false, retryable: persisted.retryable, reason: "persistence-failed" },
        { status: persisted.retryable ? 503 : 409 },
      );
    }
    return NextResponse.json({ ok: true, idempotent: persisted.data.idempotent_replay }, { status: 200 });
  }

  return NextResponse.json({ ok: false, reason: "provider-unsupported" }, { status: 200 });
}
