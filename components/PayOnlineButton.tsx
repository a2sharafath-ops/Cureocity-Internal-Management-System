"use client";

import { useState, useTransition } from "react";
import { startInvoicePayment, confirmInvoicePayment } from "@/lib/actions";

// Minimal typing for the Razorpay checkout global (loaded on demand).
type RzpOptions = {
  key: string; amount: number; currency: string; name: string; description: string;
  order_id: string; handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  theme?: { color?: string }; modal?: { ondismiss?: () => void };
};
declare global {
  interface Window { Razorpay?: new (o: RzpOptions) => { open: () => void } }
}

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const btn: React.CSSProperties = { border: "1px solid var(--teal)", background: "#fff", color: "var(--teal-dark)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };

export default function PayOnlineButton({ invoiceId, configured }: { invoiceId: string; configured: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!configured) {
    return <span title="Set PAYMENT_PROVIDER + gateway keys to enable" style={{ color: "var(--muted)", fontSize: 12, cursor: "help" }}>Gateway off</span>;
  }

  const pay = () => {
    setMsg(null);
    const fd = new FormData();
    fd.set("id", invoiceId);
    start(async () => {
      const res = await startInvoicePayment(fd);
      if (!res.configured) { setMsg("Gateway not configured"); return; }
      if (!("ok" in res) || !res.ok) { setMsg(("error" in res && res.error) ? res.error : "Could not start"); return; }
      const ok = await loadCheckout();
      if (!ok || !window.Razorpay) { setMsg("Checkout failed to load"); return; }
      const rzp = new window.Razorpay({
        key: res.keyId ?? "",
        amount: res.amount ?? 0, currency: res.currency ?? "INR",
        name: "Cureocity", description: res.description ?? "Invoice payment",
        order_id: res.orderId ?? "",
        theme: { color: "#0f766e" },
        handler: (r) => {
          const cf = new FormData();
          cf.set("id", invoiceId);
          cf.set("order_id", r.razorpay_order_id);
          cf.set("payment_id", r.razorpay_payment_id);
          cf.set("signature", r.razorpay_signature);
          start(async () => {
            const c = await confirmInvoicePayment(cf);
            setMsg(c.ok ? "Paid ✓" : (c.error ?? "Verification failed"));
          });
        },
        modal: { ondismiss: () => setMsg("Payment cancelled") },
      });
      rzp.open();
    });
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={pay} disabled={pending} style={{ ...btn, opacity: pending ? 0.6 : 1 }}>{pending ? "…" : "Pay online"}</button>
      {msg && <span style={{ fontSize: 12, color: msg.includes("✓") ? "var(--teal-dark)" : "var(--muted)" }}>{msg}</span>}
    </span>
  );
}
