"use client";

import { useState } from "react";
import { createConsultation } from "@/lib/actions";

const KINDS = ["Doctor", "Diet", "Trainer", "Coach", "Psychologist"];

const input: React.CSSProperties = {
  width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
  borderRadius: 8, fontSize: 14, background: "#fff",
};

export default function ConsultationForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <b style={{ fontSize: 14 }}>New consultation</b>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
          {open ? "Cancel" : "+ New"}
        </button>
      </div>
      {open && (
        <form action={createConsultation} style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Client</label>
            <select name="client_id" style={input} required defaultValue="">
              <option value="" disabled>Select a client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Type</label>
            <select name="kind" style={input} defaultValue="Doctor">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Notes (optional)</label>
            <textarea name="notes" rows={2} style={input} placeholder="Reason / context…" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Create consultation
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
