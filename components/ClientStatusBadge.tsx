import Link from "next/link";
import type { ClientStatus, StatusTone } from "@/lib/client-status";

// One consistent status chip, used wherever a client is shown. Role-aware value
// is computed by clientStatus(); this just renders it.
const TONE: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--neutral-bg)", fg: "var(--muted)" },
  info: { bg: "var(--blue-bg, #e0f2fe)", fg: "var(--blue-text, #0369a1)" },
  warn: { bg: "var(--amber-bg)", fg: "var(--amber-text)" },
  good: { bg: "var(--green-bg)", fg: "var(--green-text)" },
  action: { bg: "var(--brand-tint)", fg: "var(--brand-text)" },
};

export default function ClientStatusBadge({ status, size = "md" }: { status: ClientStatus; size?: "sm" | "md" }) {
  const t = TONE[status.tone] ?? TONE.neutral;
  const pad = size === "sm" ? "2px 8px" : "3px 10px";
  const fs = size === "sm" ? 11 : 11.5;
  const chip = (
    <span style={{ background: t.bg, color: t.fg, borderRadius: 999, padding: pad, fontSize: fs, fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }}>
      {status.label}
    </span>
  );
  return status.href ? <Link href={status.href} style={{ textDecoration: "none" }}>{chip}</Link> : chip;
}
