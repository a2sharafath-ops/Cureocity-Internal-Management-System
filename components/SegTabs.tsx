"use client";

// Design-system segmented control.
// Two modes:
//  • navigation — pass items with `href`; renders <Link>s, `active` marks the current key.
//  • stateful  — omit href, pass `onSelect`; renders <button>s.
// Active segment = raised white chip with soft shadow + ink text (design-system look),
// inactive = transparent, muted text.

import Link from "next/link";

export type Seg = { key: string; label: string; href?: string; count?: number };

export default function SegTabs({
  items, active, onSelect, size = "md",
}: {
  items: Seg[];
  active: string;
  onSelect?: (key: string) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "6px 12px" : "8px 15px";
  const fs = size === "sm" ? 12.5 : 13;

  const wrap: React.CSSProperties = {
    display: "inline-flex", gap: 4, padding: 4, background: "var(--bg)",
    border: "1px solid var(--border)", borderRadius: 12, flexWrap: "wrap",
  };
  const seg = (on: boolean): React.CSSProperties => ({
    padding: pad, borderRadius: 9, fontSize: fs, fontWeight: 600, cursor: "pointer",
    border: "none", textDecoration: "none", whiteSpace: "nowrap",
    display: "inline-flex", alignItems: "center", gap: 6,
    background: on ? "var(--card)" : "transparent",
    color: on ? "var(--ink)" : "var(--muted)",
    boxShadow: on ? "var(--shadow)" : "none",
    transition: "background .15s, color .15s",
  });
  const badge = (on: boolean): React.CSSProperties => ({
    background: on ? "var(--teal-light)" : "#e7e7ea", color: on ? "var(--teal-dark)" : "var(--muted)",
    borderRadius: 999, padding: "0 7px", fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: "center",
  });

  return (
    <div style={wrap} role="tablist">
      {items.map((it) => {
        const on = it.key === active;
        const inner = (
          <>
            {it.label}
            {it.count != null && <span style={badge(on)}>{it.count}</span>}
          </>
        );
        return it.href ? (
          <Link key={it.key} href={it.href} role="tab" aria-selected={on} style={seg(on)}>{inner}</Link>
        ) : (
          <button key={it.key} type="button" role="tab" aria-selected={on} onClick={() => onSelect?.(it.key)} style={seg(on)}>{inner}</button>
        );
      })}
    </div>
  );
}
