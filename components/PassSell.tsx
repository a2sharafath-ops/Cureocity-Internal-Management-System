"use client";

import { useState } from "react";
import { sellPass } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" };

type PassType = { id: string; name: string; price: number; entries: number; valid_days: number };

export default function PassSell({ passTypes, clients }: { passTypes: PassType[]; clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Sell pass</button>;
  }
  return (
    <form action={sellPass} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Pass type</label>
        <select style={input} name="pass_type_id" required defaultValue="">
          <option value="" disabled>Pass…</option>
          {passTypes.map((p) => <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Member (or leave for guest)</label>
        <select style={input} name="client_id" value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">Guest</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {!client
        ? <div style={{ display: "grid", gap: 3 }}><label style={{ fontSize: 11, color: "var(--muted)" }}>Guest name</label><input style={input} name="guest_name" placeholder="Walk-in" /></div>
        : <div />}
      <div style={{ display: "grid", gap: 3 }}>
        <label style={{ fontSize: 11, color: "var(--muted)" }}>Payment</label>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={{ ...input, flex: 1 }} name="method" defaultValue="Cash"><option>Cash</option><option>Card</option><option>UPI</option><option>Bank</option></select>
          <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Sell</button>
        </div>
      </div>
    </form>
  );
}
