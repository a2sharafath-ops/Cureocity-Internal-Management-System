"use client";

import { useState } from "react";
import Link from "next/link";

export type FuRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  kind: string;
  label: string;
  due_date: string;
  priority: string;
  status: string;
};

function fmtDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export default function FollowupsBoard({ rows, today }: { rows: FuRow[]; today: string }) {
  const [view, setView] = useState<"open" | "done">("open");
  const open = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");
  const overdue = open.filter((r) => r.due_date < today).length;
  const list = (view === "done" ? done : open).slice().sort((a, b) => a.due_date.localeCompare(b.due_date));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const chip = (bg: string, c: string, t: string) => <span style={{ background: bg, color: c, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{t}</span>;
  const seg = (k: "open" | "done", label: string, n: number) => (
    <button type="button" onClick={() => setView(k)} style={{
      padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
      background: view === k ? "var(--card)" : "transparent", color: view === k ? "var(--ink)" : "var(--muted)",
      boxShadow: view === k ? "var(--shadow)" : "none",
    }}>{label} <span style={{ background: view === k ? "var(--brand-tint)" : "#e7e7ea", color: view === k ? "var(--brand-text)" : "var(--muted)", borderRadius: 999, padding: "0 7px", fontSize: 11, fontWeight: 700 }}>{n}</span></button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ ...box, padding: "12px 16px", flex: 1, minWidth: 130 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>Open</div><div style={{ fontSize: 22, fontWeight: 800 }}>{open.length}</div></div>
        <div style={{ ...box, padding: "12px 16px", flex: 1, minWidth: 130 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>Overdue</div><div style={{ fontSize: 22, fontWeight: 800, color: overdue ? "var(--red)" : undefined }}>{overdue}</div></div>
        <div style={{ ...box, padding: "12px 16px", flex: 1, minWidth: 130 }}><div style={{ color: "var(--muted)", fontSize: 12 }}>Completed</div><div style={{ fontSize: 22, fontWeight: 800 }}>{done.length}</div></div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12 }}>
          {seg("open", "Open", open.length)}{seg("done", "Completed", done.length)}
        </div>
        <span style={{ flex: 1 }} />
        <Link href="/followups" style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>Full follow-up queue →</Link>
      </div>

      <div style={{ ...box, overflow: "hidden" }}>
        {list.length ? list.map((r) => {
          const isOverdue = r.status === "pending" && r.due_date < today;
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <div style={{ width: 62, textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: isOverdue ? "var(--red)" : "var(--ink)" }}>{fmtDate(r.due_date)}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px" }}>{r.kind}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>{r.client_name ?? "—"}</b>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.label}</div>
              </div>
              {r.priority === "mandatory" && chip("var(--red-bg)", "var(--red-text)", "Mandatory")}
              {r.status === "pending"
                ? (isOverdue ? chip("var(--red-bg)", "var(--red-text)", "Overdue") : chip("var(--amber-bg)", "var(--amber-text)", "Due"))
                : chip("var(--green-bg)", "var(--green-text)", r.status === "done" ? "Done" : "Skipped")}
              {r.client_id && <Link href={`/clients/${r.client_id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)" }}>Card</Link>}
            </div>
          );
        }) : <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No {view === "done" ? "completed" : "open"} follow-ups for your clients.</div>}
      </div>
    </div>
  );
}
