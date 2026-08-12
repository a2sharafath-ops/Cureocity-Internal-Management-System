import Link from "next/link";
import type { CoachAlertLevel, CoachRuleAlert } from "@/lib/coach-alerts";

const LEVEL: Record<CoachAlertLevel, { label: string; bg: string; text: string; border: string }> = {
  red: { label: "Red · act now", bg: "#fff1f2", text: "#991b1b", border: "#fecaca" },
  amber: { label: "Amber · action due", bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  blue: { label: "Blue · coordinate", bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  green: { label: "Green · reinforce", bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
};

export default function CoachPriorityBoard({ alerts }: { alerts: CoachRuleAlert[] }) {
  const counts = (Object.keys(LEVEL) as CoachAlertLevel[]).map((level) => ({
    level, count: alerts.filter((alert) => alert.level === level).length,
  }));

  return (
    <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 750 }}>Coach priorities</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
            Rules from the SOP, kept separate: safety, coaching action, care-team coordination and wins.
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {counts.map(({ level, count }) => (
            <span key={level} style={{ background: LEVEL[level].bg, color: LEVEL[level].text, border: `1px solid ${LEVEL[level].border}`, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 750 }}>
              {LEVEL[level].label.split(" · ")[0]} {count}
            </span>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", color: "var(--muted)", fontSize: 12.5 }}>
          No active coaching alerts or recent wins for this caseload.
        </div>
      ) : alerts.slice(0, 16).map((alert) => {
        const tone = LEVEL[alert.level];
        return (
          <div key={alert.key} style={{ borderTop: "1px solid var(--border)", padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, background: tone.bg }}>
            <span style={{ color: tone.text, border: `1px solid ${tone.border}`, background: "#fff", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750, whiteSpace: "nowrap" }}>{tone.label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 750 }}>{alert.clientName} — {alert.title.toLowerCase()}</div>
              <div style={{ color: tone.text, opacity: 0.85, fontSize: 11.5, marginTop: 2 }}>{alert.detail}</div>
            </div>
            <Link href={alert.href} style={{ border: `1px solid ${tone.border}`, background: "#fff", color: tone.text, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 750, textDecoration: "none", whiteSpace: "nowrap" }}>
              {alert.actionLabel} →
            </Link>
          </div>
        );
      })}
      {alerts.length > 16 && <div style={{ borderTop: "1px solid var(--border)", padding: "8px 16px", color: "var(--muted)", fontSize: 11.5 }}>{alerts.length - 16} more alerts are available from the relevant client records.</div>}
    </section>
  );
}
