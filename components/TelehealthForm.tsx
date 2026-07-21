"use client";

import { useState } from "react";
import { createTelehealthSession } from "@/lib/actions";

const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" , height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function TelehealthForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New session</button>;
  return (
    <form action={createTelehealthSession} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1.6fr 1.4fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Patient</label><select style={input} name="client_id" defaultValue=""><option value="">— (ad-hoc room)</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Scheduled for</label><input style={input} name="scheduled_for" type="datetime-local" /></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create room</button>
    </form>
  );
}
