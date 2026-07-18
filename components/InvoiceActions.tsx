"use client";

import { useState } from "react";
import { markInvoicePaid, refundInvoice } from "@/lib/actions";

const METHODS = ["Cash", "Card", "UPI", "Bank", "Online"];

export default function InvoiceActions({ id, status }: { id: string; status: string }) {
  const [open, setOpen] = useState(false);

  if (status === "Refunded") return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;

  if (status === "Paid") {
    return (
      <form action={refundInvoice}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--red)" }}>
          Refund
        </button>
      </form>
    );
  }

  // Unpaid
  return open ? (
    <form action={markInvoicePaid} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="hidden" name="id" value={id} />
      <select name="method" defaultValue="Cash" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12 }}>
        {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <button type="submit" style={{ border: "none", background: "var(--green)", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Confirm paid</button>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, cursor: "pointer" }}>
      Mark paid
    </button>
  );
}
