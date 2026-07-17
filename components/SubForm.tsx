"use client";

import { useState } from "react";
import { createSubscription } from "@/lib/actions";

const input: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" };

export default function SubForm({
  clients, packages,
}: { clients: { id: string; name: string }[]; packages: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New subscription</button>;
  }
  return (
    <form action={createSubscription} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 16, display: "grid", gridTemplateColumns: "1.5fr 1.5fr auto auto", gap: 10, alignItems: "end" }}>
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Client</label>
        <select style={input} name="client_id" required defaultValue="">
          <option value="" disabled>Client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Package (recurring)</label>
        <select style={input} name="package_id" required defaultValue="">
          <option value="" disabled>Package…</option>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" name="auto_renew" value="true" defaultChecked /> Auto-renew
      </label>
      <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Create</button>
    </form>
  );
}
