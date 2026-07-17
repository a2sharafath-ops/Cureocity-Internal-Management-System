"use client";

import { useState } from "react";
import { recordCheckin } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" };
const lbl: React.CSSProperties = { fontSize: 11, color: "var(--muted)" };

export default function CheckinForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [client, setClient] = useState("");
  return (
    <form action={recordCheckin} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 18, display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr auto auto", gap: 10, alignItems: "end" }}>
      <div style={{ display: "grid", gap: 3 }}>
        <label style={lbl}>Member</label>
        <select style={input} name="client_id" value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">Guest / walk-in</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {!client
        ? <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Guest name</label><input style={input} name="guest_name" placeholder="Walk-in name" /></div>
        : <div />}
      <div style={{ display: "grid", gap: 3 }}>
        <label style={lbl}>Method</label>
        <select style={input} name="method" defaultValue="manual"><option value="manual">Manual</option><option value="card">Card</option><option value="biometric">Biometric</option><option value="qr">QR</option></select>
      </div>
      <button type="submit" name="direction" value="in" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🚪 Check in</button>
      <button type="submit" name="direction" value="out" style={{ background: "#fff", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Check out</button>
    </form>
  );
}
