"use client";

import { useState } from "react";
import Link from "next/link";

// Collapsible per-client card so a dietitian with many clients can scan the list
// and expand only the ones needing attention. Caught-up clients start collapsed.
export default function MealClientCard({
  clientId, name, pending, badge, defaultOpen, children,
}: {
  clientId: string;
  name: string;
  pending: number;
  badge: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", marginBottom: 12, overflow: "hidden" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", cursor: "pointer" }}
      >
        <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--muted)", fontSize: 12 }}>▶</span>
        <Link href={`/clients/${clientId}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", textDecoration: "none" }}>{name}</Link>
        <span onClick={(e) => e.stopPropagation()}>{badge}</span>
        <span style={{ flex: 1 }} />
        {pending > 0
          ? <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{pending} to action</span>
          : <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>All caught up</span>}
      </div>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}
