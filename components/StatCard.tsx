// Design-system KPI / stat card (pure, server-safe).
// Superset of the ad-hoc kpi()/stat() helpers scattered across pages:
//  • plain label (muted) OR a colored badge label (pass `badge`)
//  • big value with optional accent color
//  • optional sub caption
import type React from "react";

export default function StatCard({
  label, value, sub, color, badge, minWidth = 150, align = "left",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  badge?: { bg: string; color: string };
  minWidth?: number;
  align?: "left" | "center";
}) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
      boxShadow: "var(--shadow)", padding: "14px 16px", flex: 1, minWidth, textAlign: align,
    }}>
      {badge ? (
        <div style={{ display: "inline-flex", background: badge.bg, color: badge.color, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>{label}</div>
      )}
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 12 }}>{sub}</div>}
    </div>
  );
}
