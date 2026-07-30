// Shared "status-in-label" renderer. A label like "Doctor consultation — booked"
// carries its status in the text, which reads the same as a to-do. This pulls a
// recognised trailing status out into a coloured badge so progress (booked,
// sent, done) or trouble (overdue, unpaid) is obvious at a glance.
//
// Used across the client journey lists so the treatment is identical everywhere.

import React from "react";

const STATUS_TONES: { re: RegExp; bg: string; color: string }[] = [
  { re: /^(booked|scheduled|drafted|created|sent|done|received|generated|approved|published|complete[d]?|paid|active|shared)$/i, bg: "var(--green-bg)", color: "var(--green-text)" },
  { re: /^(overdue|unpaid|missed|expired|breached|cancelled)$/i, bg: "var(--red-bg)", color: "var(--red-text)" },
  { re: /(due|pending|awaiting|awaited|expiring|not |in review|draft)/i, bg: "var(--amber-bg)", color: "var(--amber-text)" },
];

export function splitStatus(label: string): { main: string; badge?: { text: string; bg: string; color: string } } {
  const m = label.match(/^(.*?)\s+[—-]\s+(.+)$/);
  if (!m) return { main: label };
  const suffix = m[2].trim();
  const tone = STATUS_TONES.find((t) => t.re.test(suffix));
  if (!tone) return { main: label };
  return { main: m[1].trim(), badge: { text: suffix, bg: tone.bg, color: tone.color } };
}

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  marginLeft: 6, background: bg, color, borderRadius: 999, padding: "1px 8px",
  fontSize: 10.5, fontWeight: 700, textTransform: "capitalize", whiteSpace: "nowrap",
});

// Render a label with its trailing status (if any) as a badge. `size` tweaks the
// pill for denser rows.
export default function StatusLabel({ label, style }: { label: string; style?: React.CSSProperties }) {
  const { main, badge } = splitStatus(label);
  return (
    <span style={style}>
      {main}
      {badge && <span style={badgeStyle(badge.bg, badge.color)}>{badge.text}</span>}
    </span>
  );
}
