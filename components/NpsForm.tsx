"use client";

import { useState } from "react";
import { recordNps } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" };

export default function NpsForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "#fff", color: "var(--teal-dark)", border: "1px solid var(--teal)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Record feedback</button>;
  }
  return (
    <form action={recordNps} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "1.6fr auto auto 2fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Client</label>
        <select style={input} name="client_id" required defaultValue="">
          <option value="" disabled>Client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Score 0–10</label>
        <input style={{ ...input, width: 80 }} name="score" type="number" min={0} max={10} required />
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Channel</label>
        <select style={input} name="channel" defaultValue="front-desk">
          <option value="front-desk">Front desk</option>
          <option value="phone">Phone</option>
          <option value="email">Email</option>
          <option value="in-app">In-app</option>
        </select>
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Comment</label>
        <input style={input} name="comment" placeholder="Optional" />
      </div>
      <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
    </form>
  );
}
