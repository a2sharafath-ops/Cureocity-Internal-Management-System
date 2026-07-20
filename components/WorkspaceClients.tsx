"use client";

import { useState } from "react";
import Link from "next/link";

export type WsClientRow = {
  id: string;
  name: string;
  code: string | null;
  pkg: string | null;
  conditions: string | null;
  goals: string[];
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function WorkspaceClients({
  role, color, clients, linkQuery = "",
}: {
  role: "doctor" | "diet" | "trainer" | "coach" | "psych";
  color: string;
  clients: WsClientRow[];
  linkQuery?: string;
}) {
  const [sel, setSel] = useState<string | null>(clients[0]?.id ?? null);
  const c = clients.find((x) => x.id === sel) ?? null;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const chip = (bg: string, col: string, t: string) => <span style={{ background: bg, color: col, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{t}</span>;
  const kv = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ width: 150, color: "var(--muted)", fontSize: 12.5 }}>{k}</div>
      <div style={{ flex: 1, fontSize: 13 }}>{v || <span style={{ color: "var(--muted)" }}>—</span>}</div>
    </div>
  );

  const roleExtras = (r: WsClientRow) => {
    const ro = !!linkQuery; // read-only: don't offer jump-into-edit deep links
    if (role === "diet") return (
      <>
        {kv("Goals", r.goals.length ? r.goals.join(", ") : null)}
        {kv("Conditions", r.conditions)}
        {!ro && kv("Meal monitoring", <Link href="/meals" style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>Open meal follow-ups →</Link>)}
      </>
    );
    if (role === "trainer") return (
      <>
        {kv("Goals", r.goals.length ? r.goals.join(", ") : null)}
        {!ro && kv("Session board", <Link href="/trainer" style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>Open trainer board →</Link>)}
      </>
    );
    if (role === "doctor") return (
      <>
        {kv("Conditions", r.conditions)}
        {!ro && kv("Clinical record", <Link href={`/emr/${r.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>Open EMR chart →</Link>)}
      </>
    );
    return (
      <>
        {kv("Goals", r.goals.length ? r.goals.join(", ") : null)}
        {kv("Conditions", r.conditions)}
        {!ro && kv("Blueprint", <Link href="/blueprint" style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>Open BluePrint →</Link>)}
      </>
    );
  };

  if (clients.length === 0) {
    return <div style={{ ...box, padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No clients assigned to this workspace yet.</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ ...box, padding: 10 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--muted)", fontWeight: 700, padding: "4px 6px 8px" }}>My Clients · {clients.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {clients.map((x) => (
            <button key={x.id} type="button" onClick={() => setSel(x.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 10, cursor: "pointer",
              border: "none", textAlign: "left", background: x.id === sel ? "var(--brand-tint)" : "transparent",
            }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(x.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{x.code ?? x.pkg ?? "—"}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...box, padding: "16px 18px" }}>
        {c && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 }}>{initials(c.name)}</div>
              <div>
                <b style={{ fontSize: 16 }}>{c.name}</b>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{[c.code, c.pkg].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <span style={{ flex: 1 }} />
              {c.conditions && chip("var(--amber-bg)", "var(--amber-text)", "⚠️ Condition")}
              <Link href={`/clients/${c.id}${linkQuery}`} style={{ background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>📋 Open full client card</Link>
            </div>
            <div style={{ marginTop: 10 }}>
              {kv("Package", c.pkg)}
              {roleExtras(c)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
