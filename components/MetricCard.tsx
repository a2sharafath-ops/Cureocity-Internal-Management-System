// A single clickable metric — big number, label, and a link through to the page
// where that number can actually be worked on. Used for the owner dashboard's
// Today and Growth rows.

import Link from "next/link";

export default function MetricCard({
  value, label, sub, href, icon, accent,
}: {
  value: string | number;
  label: string;
  sub?: string;
  href: string;
  icon?: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none", color: "inherit", display: "block",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "12px 14px", minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
        <span style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: accent ?? "var(--ink)" }}>{value}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: "var(--teal-dark)", fontSize: 15, fontWeight: 700 }}>→</span>
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {sub}
        </div>
      )}
    </Link>
  );
}
