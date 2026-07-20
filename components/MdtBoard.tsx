"use client";

import { useState } from "react";
import Link from "next/link";
import { addMdtNote, acknowledgeMdt } from "@/lib/actions";

export type MdtRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  author: string | null;
  body: string;
  escalated: boolean;
  to_role: string | null;
  status: string | null;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = { doctor: "Doctor", diet: "Dietitian", trainer: "Trainer", coach: "Health Coach" };

export default function MdtBoard({ notes, clients }: { notes: MdtRow[]; clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [esc, setEsc] = useState(false);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%" };
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Multidisciplinary notes &amp; escalations across the care team.</div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{open ? "Cancel" : "+ Add MDT update"}</button>
      </div>

      {open && (
        <form action={addMdtNote} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select name="client_id" defaultValue="" style={inp}>
              <option value="">— No specific client —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" name="escalated" checked={esc} onChange={(e) => setEsc(e.target.checked)} /> Escalate to another discipline
            </label>
          </div>
          {esc && (
            <select name="to_role" defaultValue="doctor" style={inp}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <textarea name="body" required placeholder="Update, observation or escalation reason…" rows={3} style={{ ...inp, resize: "vertical" }} />
          <div><button style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Post update</button></div>
        </form>
      )}

      <div style={{ ...box, overflow: "hidden" }}>
        {notes.length ? notes.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: m.escalated ? "#ede9fe" : "var(--sidebar-hover)", color: m.escalated ? "#6d28d9" : "var(--brand-text)", display: "grid", placeItems: "center", fontSize: 15, flexShrink: 0 }}>{m.escalated ? "⤴" : "🗒️"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13 }}>{m.author ?? "—"}</b>
                {m.client_name && <span style={{ color: "var(--muted)", fontSize: 12 }}>· {m.client_name}</span>}
                {m.escalated && <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>→ {ROLE_LABEL[m.to_role ?? ""] ?? m.to_role}</span>}
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{fmt(m.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 3 }}>{m.body}</div>
            </div>
            {m.client_id && <Link href={`/clients/${m.client_id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)", whiteSpace: "nowrap" }}>Card</Link>}
            {m.escalated && m.status === "Open" ? (
              <form action={acknowledgeMdt}>
                <input type="hidden" name="id" value={m.id} />
                <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Acknowledge</button>
              </form>
            ) : m.escalated ? <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>✓ {m.status}</span> : null}
          </div>
        )) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No MDT updates yet.</div>}
      </div>
    </div>
  );
}
