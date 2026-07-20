"use client";

// Owner dashboard exception queue. Collapsed by default: a single operations
// health score + severity counts. Click to expand the full item list.

import { useState } from "react";
import Link from "next/link";
import { RingMeter } from "@/components/Meters";

export type Flag = { sev: "high" | "med" | "low"; title: string; detail: string; href: string; cta: string };

const SEV = {
  high: { bg: "var(--red-bg)", col: "var(--red-text)", label: "Urgent", weight: 10 },
  med: { bg: "var(--amber-bg)", col: "var(--amber-text)", label: "Soon", weight: 4 },
  low: { bg: "var(--neutral-bg)", col: "var(--muted)", label: "Tidy", weight: 1.5 },
} as const;

/** 100 = clean books. Each open item costs points by severity. */
export function healthScore(flags: Flag[]): number {
  const penalty = flags.reduce((n, f) => n + SEV[f.sev].weight, 0);
  return Math.max(0, Math.round(100 - penalty));
}

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
};

export default function AttentionPanel({ flags }: { flags: Flag[] }) {
  const [open, setOpen] = useState(false);
  const score = healthScore(flags);
  const counts = {
    high: flags.filter((f) => f.sev === "high").length,
    med: flags.filter((f) => f.sev === "med").length,
    low: flags.filter((f) => f.sev === "low").length,
  };
  const verdict =
    score >= 90 ? "Books are clean" :
    score >= 70 ? "Minor housekeeping" :
    score >= 40 ? "Needs a look this week" :
    "Several things are slipping";

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--muted)", textTransform: "uppercase" }}>
          Needs your attention
        </span>
        <span style={{
          background: flags.length ? "var(--red-bg)" : "var(--green-bg)",
          color: flags.length ? "var(--red-text)" : "var(--green-text)",
          borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700,
        }}>{flags.length}</span>
      </div>

      <div style={{ ...box, overflow: "hidden" }}>
        {/* summary header — the whole strip is the toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          disabled={flags.length === 0}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 18,
            padding: "14px 16px", background: "transparent", border: "none",
            textAlign: "left", cursor: flags.length ? "pointer" : "default", font: "inherit",
          }}
        >
          <RingMeter value={score} size={72} stroke={8} label={undefined} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {flags.length ? verdict : "Nothing needs attention 🎉"}
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 6 }}>
              {(["high", "med", "low"] as const).map((s) =>
                counts[s] ? (
                  <span key={s} style={{
                    background: SEV[s].bg, color: SEV[s].col, borderRadius: 999,
                    padding: "2px 10px", fontSize: 11, fontWeight: 700,
                  }}>
                    {counts[s]} {SEV[s].label.toLowerCase()}
                  </span>
                ) : null
              )}
              {!flags.length && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  No unbilled packages, overdue invoices or stalled onboarding.
                </span>
              )}
            </div>
          </div>

          {flags.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--brand-text)", whiteSpace: "nowrap" }}>
              {open ? "Hide" : `Review ${flags.length}`}
              <span style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>⌄</span>
            </span>
          )}
        </button>

        {/* expanded list */}
        {open && flags.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <span style={{
              background: SEV[f.sev].bg, color: SEV[f.sev].col, borderRadius: 999,
              padding: "2px 10px", fontSize: 10.5, fontWeight: 700, minWidth: 58, textAlign: "center",
            }}>{SEV[f.sev].label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{f.title}</b>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{f.detail}</div>
            </div>
            <Link href={f.href} style={{
              border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
              padding: "5px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none",
              color: "var(--brand-text)", whiteSpace: "nowrap",
            }}>{f.cta} →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
