import { NextResponse } from "next/server";
import { paymentConfig } from "@/lib/payments/config";
import { verifyRazorpayWebhook } from "@/lib/payments/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/today";

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
    let event: {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
    };
    try { event = JSON.parse(raw); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const pay = event.payload?.payment?.entity;
      const orderId = pay?.order_id;
      const paymentId = pay?.id;
      if (orderId) {
        // service-role client: webhooks have no user session
        const admin = createAdminClient();
        await admin.from("invoices").update({
          status: "Paid", paid_date: todayISO(), method: "Online",
          gateway: "razorpay", gateway_payment_id: paymentId ?? null,
        }).eq("gateway_order_id", orderId).eq("status", "Unpaid");
      }
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return NextResponse.json({ ok: false, reason: "provider-unsupported" }, { status: 200 });
}
