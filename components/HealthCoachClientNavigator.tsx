import Link from "next/link";
import { HEALTH_COACH_RECORD_SECTIONS, healthCoachRecordHref } from "@/lib/health-coach-ux";

type Props = {
  clientId: string;
  baselineStatus: string;
  baselinePercent: number;
  activeGoals: number;
  openBarriers: number;
  programmeStatus: string;
  openReferrals: number;
  openSafety: number;
};

export default function HealthCoachClientNavigator({
  clientId, baselineStatus, baselinePercent, activeGoals, openBarriers,
  programmeStatus, openReferrals, openSafety,
}: Props) {
  const detailByKey: Record<(typeof HEALTH_COACH_RECORD_SECTIONS)[number]["key"], string> = {
    baseline: `${baselineStatus} · ${baselinePercent}%`,
    goals: `${activeGoals} active · ${openBarriers} open barrier${openBarriers === 1 ? "" : "s"}`,
    programme: programmeStatus,
    coordination: `${openReferrals} open referral${openReferrals === 1 ? "" : "s"} · ${openSafety} safety`,
  };

  return (
    <nav aria-label="Health Coach client workflow" style={{ background: "var(--card)", border: `1px solid ${openSafety ? "var(--red-text)" : "var(--border)"}`, borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 750 }}>Health Coach workflow</div>
          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>Jump to the record you need. Required SOP, consent and safety steps remain unchanged.</div>
        </div>
        <Link href="/workspace?role=coach" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>Back to my workspace →</Link>
      </div>
      {openSafety > 0 && <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "7px 9px", fontSize: 11.5, fontWeight: 700, marginBottom: 9 }}>Safety hard stop open — review Referrals &amp; safety before routine coaching.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        {HEALTH_COACH_RECORD_SECTIONS.map((section) => (
          <Link key={section.key} href={healthCoachRecordHref(clientId, section.fragment)} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "9px 10px", color: "var(--ink)", textDecoration: "none", background: section.key === "coordination" && openSafety ? "var(--red-bg)" : "#fff" }}>
            <div style={{ color: section.key === "coordination" && openSafety ? "var(--red-text)" : "var(--brand-text)", fontSize: 12, fontWeight: 750 }}>{section.label} →</div>
            <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 2 }}>{detailByKey[section.key]}</div>
          </Link>
        ))}
      </div>
    </nav>
  );
}
