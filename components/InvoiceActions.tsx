"use client";

import { useState } from "react";
import { markInvoicePaid, refundInvoice, nudgeRole } from "@/lib/actions";
import { isBillingOverseer } from "@/lib/roles";
import SubmitButton from "@/components/SubmitButton";

const METHODS = ["Cash", "Card", "UPI", "Bank", "Online"];

// Who gets chased to actually collect the money and mark the invoice paid.
const COLLECTOR_ROLES = "Front Desk,Finance";

export default function InvoiceActions({
  id, status, role = "", clientId, label,
}: { id: string; status: string; role?: string; clientId?: string; label?: string }) {
  const [open, setOpen] = useState(false);

  if (status === "Refunded") return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;

  if (status === "Paid") {
    return (
      <form action={refundInvoice}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton pendingLabel="Refunding…" doneLabel="✓ Refunded" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--red)" }}>
          Refund
        </SubmitButton>
      </form>
    );
  }

  // Only a genuinely unpaid invoice has an action. Void / Cancelled and any
  // other settled state get no action (a removed package's invoice, say).
  if (status !== "Unpaid") return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;

  // Admin / Manager oversee — they chase the collector rather than mark it paid.
  if (isBillingOverseer(role)) {
    return (
      <form action={nudgeRole}>
        <input type="hidden" name="roles" value={COLLECTOR_ROLES} />
        <input type="hidden" name="label" value={`Collect payment${label ? ` — ${label}` : ""}`} />
        {clientId && <input type="hidden" name="client_id" value={clientId} />}
        <input type="hidden" name="href" value="/billing" />
        <SubmitButton pendingLabel="Chasing…" doneLabel="✓ Chased" style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          Chase Front Desk
        </SubmitButton>
      </form>
    );
  }

  // Collector (Finance / Super Admin) marks it paid.
  return open ? (
    <form action={markInvoicePaid} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="id" value={id} />
      <select name="method" defaultValue="Cash" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12 }}>
        {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <SubmitButton pendingLabel="Saving…" doneLabel="✓ Paid" style={{ border: "none", background: "var(--green)", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Confirm paid</SubmitButton>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>
      Mark paid
    </button>
  );
}
