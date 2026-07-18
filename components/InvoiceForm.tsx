"use client";

import { useState } from "react";
import { createInvoice } from "@/lib/actions";

const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" };

export default function InvoiceForm({ clientId }: { clientId?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, cursor: "pointer" }}>
        + New invoice
      </button>
    );
  }
  return (
    <form action={createInvoice} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "#f8fbfa", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, alignItems: "end" }}>
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Description</label>
        <input style={input} name="description" placeholder="e.g. PT top-up / product" required />
      </div>
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Amount (₹)</label>
        <input style={input} type="number" step="1" name="amount" required />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create</button>
        <button type="button" onClick={() => setOpen(false)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </form>
  );
}
