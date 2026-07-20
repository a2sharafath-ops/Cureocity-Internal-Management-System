// The one primitive for every dashboard metric.
// Spec: docs/metric-card-anatomy.md — five slots, in reading order:
//   01 LABEL · 02 VALUE · 03 CONTEXT · 04 TREND · 05 ACTION
//
// Supersedes StatCard, which was the same card without a ring, without a
// trend, and without a drill-down — pages that wanted one wrapped it in an
// external <Link> to fake slot 05.

import Link from "next/link";
import { RingMeter } from "@/components/Meters";

/** 04 — direction and judgement are separate facts. See the spec: a rising
 *  number is not automatically good, so sentiment is declared, never derived
 *  from the sign of `delta`. */
export type Trend = {
  /** signed percent change; drives the arrow only */
  delta: number;
  /** drives the colour */
  sentiment: "good" | "bad" | "neutral";
  /** the baseline, e.g. "vs last month" */
  since?: string;
};

const TREND_COLOR: Record<Trend["sentiment"], string> = {
  good: "var(--green-text)",
  bad: "var(--red-text)",
  neutral: "var(--neutral-text)",
};

// 02 — the value sits inside the ring only while it fits. Past this it moves
// out and the ring becomes a pure progress arc, which is what lets money use
// the same primitive as counts.
const GLYPH_BUDGET = 4;

export default function MetricCard({
  value, label, sub, trend, href, meter, color, badge, minWidth = 150, align = "left",
}: {
  /** 01 */ label: string;
  /** 02 */ value: string | number;
  /** 03 — required whenever `meter` is set, or the arc has no legend */
  sub?: string;
  /** 04 */ trend?: Trend;
  /** 05 — omit for a static card: no arrow, no hover, no pointer */
  href?: string;
  meter?: { of: number; filled: number };
  /** accent for the ring and the value */
  color?: string;
  /** label variant: a coloured category badge instead of muted text */
  badge?: { bg: string; color: string };
  minWidth?: number;
  align?: "left" | "center";
}) {
  const pct = meter && meter.of > 0 ? (meter.filled / meter.of) * 100 : 0;
  const text = String(value);
  const inRing = Boolean(meter) && text.length <= GLYPH_BUDGET;

  const labelEl = badge ? (
    <div style={{ display: "inline-flex", background: badge.bg, color: badge.color, borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
      {label}
    </div>
  ) : (
    <div style={{ fontSize: meter ? 13 : 12, fontWeight: meter ? 700 : 400, color: meter ? undefined : "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {label}
    </div>
  );

  const subEl = sub && (
    <div style={{ fontSize: meter ? 11.5 : 12, color: "var(--muted)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {sub}
    </div>
  );

  // A delta of exactly 0 is "no change" — neutral, no arrow. An arrow with no
  // movement reads as movement.
  const trendEl = trend && (
    <div style={{ fontSize: 11.5, fontWeight: 600, color: TREND_COLOR[trend.sentiment], marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {trend.delta === 0 ? "no change" : `${trend.delta > 0 ? "▲" : "▼"} ${Math.abs(trend.delta)}%`}
      {trend.since && <span style={{ color: "var(--muted)", fontWeight: 400 }}>{"  "}{trend.since}</span>}
    </div>
  );

  const body = meter ? (
    // Ring layout — the dashboard "Today" / "Growth" cards.
    <>
      <RingMeter
        value={pct}
        size={54}
        stroke={6}
        centerText={inRing ? text : ""}
        color={color ?? (pct > 0 ? undefined : "#e2e8f0")}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {labelEl}
        {!inRing && <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 1 }}>{text}</div>}
        {subEl}
        {trendEl}
      </div>
    </>
  ) : (
    // Flat layout — KPI rows on leads, billing, HR, retention.
    <div style={{ minWidth: 0, width: "100%" }}>
      {labelEl}
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color }}>{text}</div>
      {subEl}
      {trendEl}
    </div>
  );

  const base: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    minWidth: 0,
    ...(meter
      ? { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }
      : { boxShadow: "var(--shadow)", padding: "14px 16px", flex: 1, minWidth, textAlign: align }),
  };

  // 05 — a card that looks clickable and isn't is worse than either state, so
  // the arrow and the whole-card hit target appear together or not at all.
  if (!href) return <div style={base}>{body}</div>;

  return (
    <Link href={href} style={{ ...base, textDecoration: "none", color: "inherit", display: meter ? "flex" : "block" }}>
      {body}
      {meter && <span style={{ color: "var(--brand-text)", fontSize: 15, fontWeight: 700 }}>→</span>}
      {!meter && <span style={{ color: "var(--brand-text)", fontSize: 12.5, fontWeight: 700, display: "inline-block", marginTop: 6 }}>→</span>}
    </Link>
  );
}
