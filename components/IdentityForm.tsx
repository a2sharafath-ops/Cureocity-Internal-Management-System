"use client";

import { useState } from "react";
import { setClientIdentity } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function IdentityForm({ clients }: { clients: { id: string; name: string; abha_id: string | null; uhid: string | null }[] }) {
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState("");
  const sel = clients.find((c) => c.id === cid);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Link identity</button>;
  return (
    <form action={setClientIdentity} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1.2fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Patient</label>
        <select style={input} name="client_id" required value={cid} onChange={(e) => setCid(e.target.value)}><option value="" disabled>Patient…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>ABHA ID</label><input style={input} name="abha_id" defaultValue={sel?.abha_id ?? ""} placeholder="14-digit" /></div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>UHID</label><input style={input} name="uhid" defaultValue={sel?.uhid ?? ""} /></div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
    </form>
  );
}
