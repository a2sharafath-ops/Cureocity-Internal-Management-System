"use client";

import { useState } from "react";
import { setSalesTarget } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function TargetForm({ month, revenue, newClients, renewals }: { month: string; revenue: number; newClients: number; renewals: number }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⚙️ Set targets</button>;
  return (
    <form action={setSalesTarget} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <input type="hidden" name="month" value={month} />
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Revenue target (₹)</label><input style={input} name="revenue_target" type="number" min={0} defaultValue={revenue} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>New clients</label><input style={input} name="new_clients_target" type="number" min={0} defaultValue={newClients} /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Renewals</label><input style={input} name="renewals_target" type="number" min={0} defaultValue={renewals} /></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
    </form>
  );
}
