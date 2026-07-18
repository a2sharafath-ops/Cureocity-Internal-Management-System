// Design-system data-viz meters (pure SVG, server-safe).
// RingMeter — donut showing a % / score. Gauge — large 270° dial.

import type React from "react";

function toneFor(pct: number): string {
  if (pct >= 70) return "#16a34a";   // green
  if (pct >= 40) return "#f59e0b";   // amber
  return "#ef4444";                  // red
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, endDeg);
  const e = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function RingMeter({
  value, max = 100, size = 92, stroke = 10, color, label, centerText, track = "#eef2f1",
}: { value: number; max?: number; size?: number; stroke?: number; color?: string; label?: string; centerText?: string; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const dash = (pct / 100) * c;
  const stroked = color ?? toneFor(pct);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ? `${label}: ${Math.round(pct)}%` : undefined}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroked} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.28} fontWeight={800} fill="var(--ink)">
          {centerText ?? Math.round(value)}
        </text>
      </svg>
      {label && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{label}</div>}
    </div>
  );
}

export function Gauge({
  value, min = 0, max = 100, unit, label, color, size = 200, caption,
}: { value: number; min?: number; max?: number; unit?: string; label?: string; color?: string; size?: number; caption?: string }) {
  const stroke = Math.round(size * 0.085);
  const r = (size - stroke) / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const START = 135, SWEEP = 270;
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const end = START + frac * SWEEP;
  const stroked = color ?? toneFor(frac * 100);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ? `${label}: ${value}${unit ?? ""}` : undefined}>
        <path d={arcPath(cx, cy, r, START, START + SWEEP)} fill="none" stroke="#eef2f1" strokeWidth={stroke} strokeLinecap="round" />
        {frac > 0 && <path d={arcPath(cx, cy, r, START, end)} fill="none" stroke={stroked} strokeWidth={stroke} strokeLinecap="round" />}
        <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight={800} fill="var(--ink)">{Math.round(value)}</text>
        {unit && <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.075} fill="var(--muted)">{unit}</text>}
      </svg>
      {label && <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>}
      {caption && <div style={{ fontSize: 12, color: "var(--muted)" }}>{caption}</div>}
    </div>
  );
}
