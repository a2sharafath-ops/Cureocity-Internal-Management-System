"use client";

import { useState } from "react";
import { createReferral } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" };

export default function ReferralForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--brand-text)", border: "1px solid var(--brand-fill)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add referral</button>;
  }
  return (
    <form action={createReferral} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.4fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Referred by</label>
        <select style={input} name="referrer_id" defaultValue="">
          <option value="">— (unknown)</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>New prospect name</label>
        <input style={input} name="referred_name" required placeholder="Full name" />
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Phone</label>
        <input style={input} name="referred_phone" placeholder="Optional" />
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Email</label>
        <input style={input} name="referred_email" placeholder="Optional" />
      </div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
    </form>
  );
}
