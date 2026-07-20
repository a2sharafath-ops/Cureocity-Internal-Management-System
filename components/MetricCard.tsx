// A single clickable metric, shown as a ring meter rather than a decorative
// icon: the number sits inside the ring, and the arc carries a real ratio
// (explained by `sub`) so the card says something at a glance.

import Link from "next/link";
import { RingMeter } from "@/components/Meters";

export default function MetricCard({
  value, label, sub, href, meter, color,
}: {
  value: string | number;
  label: string;
  sub?: string;
  href: string;
  /** the arc: `of` is the denominator, `sub` should say what the ratio means */
  meter?: { of: number; filled: number };
  color?: string;
}) {
  const pct = meter && meter.of > 0 ? (meter.filled / meter.of) * 100 : 0;

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none", color: "inherit", display: "flex",
        alignItems: "center", gap: 12,
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "12px 14px", minWidth: 0,
      }}
    >
      <RingMeter
        value={pct}
        size={54}
        stroke={6}
        centerText={String(value)}
        color={color ?? (pct > 0 ? undefined : "#e2e8f0")}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </div>
        )}
      </div>
      <span style={{ color: "var(--brand-text)", fontSize: 15, fontWeight: 700 }}>→</span>
    </Link>
  );
}
