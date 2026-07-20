"use client";

import { useState } from "react";
import Link from "next/link";
import { resolveConcern } from "@/lib/actions";

export type ConcernRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  category: string | null;
  body: string;
  raised_by: string | null;
  status: string;
  created_at: string;
};

export default function ConcernsPanel({ concerns }: { concerns: ConcernRow[] }) {
  const [view, setView] = useState<"open" | "resolved">("open");
  const open = concerns.filter((c) => c.status === "Open");
  const resolved = concerns.filter((c) => c.status === "Resolved");
  const list = view === "resolved" ? resolved : open;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const toggle = (k: "open" | "resolved", label: string, n: number) => (
    <button type="button" onClick={() => setView(k)} style={{
      padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
      background: view === k ? "var(--card)" : "transparent", color: view === k ? "var(--ink)" : "var(--muted)",
      boxShadow: view === k ? "var(--shadow)" : "none",
    }}>{label} <span style={{ background: view === k ? "var(--brand-tint)" : "#e7e7ea", color: view === k ? "var(--brand-text)" : "var(--muted)", borderRadius: 999, padding: "0 7px", fontSize: 11, fontWeight: 700 }}>{n}</span></button>
  );

  return (
    <div>
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 14 }}>
        {toggle("open", "Open", open.length)}{toggle("resolved", "Resolved", resolved.length)}
      </div>

      <div style={{ ...box, overflow: "hidden" }}>
        {list.length ? list.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--amber-bg)", color: "var(--amber-text)", display: "grid", placeItems: "center", fontSize: 15, flexShrink: 0 }}>⚠️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13 }}>{c.client_name ?? "—"}</b>
                {c.category && <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 600 }}>{c.category}</span>}
                <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{fmt(c.created_at)} · raised by {c.raised_by ?? "Client"}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 3 }}>{c.body}</div>
            </div>
            {c.client_id && <Link href={`/clients/${c.client_id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)", whiteSpace: "nowrap" }}>Card</Link>}
            {c.status === "Open" ? (
              <form action={resolveConcern}>
                <input type="hidden" name="id" value={c.id} />
                <button style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Resolve</button>
              </form>
            ) : <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>✓ Resolved</span>}
          </div>
        )) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No {view} concerns.</div>}
      </div>
    </div>
  );
}
