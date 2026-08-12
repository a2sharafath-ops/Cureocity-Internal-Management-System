"use client";

import { useActionState } from "react";
import {
  addCoachQualityReview, type CoachQualityReviewState,
} from "@/lib/actions";
import {
  COACH_AUDIT_DOMAINS, type CoachAuditRatings, type CoachQualityMetrics, type RateMetric,
} from "@/lib/coach-quality";

export type CoachQualitySession = {
  id: string;
  client_name: string;
  coach_name: string;
  session_number: number;
  completed_at: string;
};

export type CoachQualityReview = {
  id: string;
  workflow_id: string;
  client_name: string;
  coach_name: string;
  session_number: number;
  ratings: CoachAuditRatings;
  overall_result: string;
  reviewer_note: string | null;
  reviewer_name: string;
  reviewed_at: string;
};

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
};
const input: React.CSSProperties = {
  width: "100%", border: "1px solid var(--border)", borderRadius: 8,
  padding: "8px 10px", background: "#fff", font: "inherit", fontSize: 12.5,
};
const label: React.CSSProperties = {
  display: "grid", gap: 4, color: "var(--muted)", fontSize: 11.5, fontWeight: 650,
};

function rateText(metric: RateMetric) {
  return metric.percent == null ? "—" : `${metric.percent}%`;
}

function Metric({ value, label: title, detail, tone }: { value: string; label: string; detail: string; tone?: string }) {
  return <div style={{ ...box, padding: "13px 14px", minWidth: 170 }}><div style={{ fontSize: 22, fontWeight: 800, color: tone }}>{value}</div><div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>{title}</div><div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{detail}</div></div>;
}

function ReviewForm({ sessions }: { sessions: CoachQualitySession[] }) {
  const [state, action] = useActionState<CoachQualityReviewState, FormData>(addCoachQualityReview, {});
  return <form action={action} style={{ ...box, padding: 16, display: "grid", gap: 12 }}>
    <div><div style={{ fontWeight: 750 }}>Review a completed session</div><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>A human reviewer must open the session record before rating it. Reviews are permanent; corrections are added as another review.</div></div>
    {state.error && <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650 }}>{state.error}</div>}
    {state.ok && <div style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650 }}>{state.ok}</div>}
    <label style={label}>Completed structured session
      <select name="workflow_id" required defaultValue="" style={input}><option value="" disabled>Select a session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.client_name} · session {session.session_number} · {session.coach_name}</option>)}</select>
    </label>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 9 }}>
      {COACH_AUDIT_DOMAINS.map((domain) => <label key={domain.key} style={label}>{domain.label}<span style={{ fontWeight: 400, fontSize: 10.5 }}>{domain.question}</span><select name={`rating_${domain.key}`} required defaultValue="" style={input}><option value="" disabled>Not reviewed</option><option>Met</option><option>Not met</option><option>Not applicable</option></select></label>)}
    </div>
    <label style={label}>Overall result<select name="overall_result" required defaultValue="" style={input}><option value="" disabled>Select result</option><option>Meets standard</option><option>Needs coaching</option><option>Clinical review required</option></select></label>
    <label style={label}>Reviewer note<textarea name="reviewer_note" rows={3} style={{ ...input, resize: "vertical" }} placeholder="Required when anything needs coaching or clinical review" /></label>
    <div><button style={{ border: 0, borderRadius: 8, background: "var(--ink)", color: "#fff", padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Save quality review</button></div>
  </form>;
}

export default function CoachQualityDashboard({
  metrics, sessions, reviews, canReview, periodDays,
}: {
  metrics: CoachQualityMetrics;
  sessions: CoachQualitySession[];
  reviews: CoachQualityReview[];
  canReview: boolean;
  periodDays: number;
}) {
  const adherenceChange = metrics.adherence.change;
  const automated = [
    { domain: COACH_AUDIT_DOMAINS[0], metric: metrics.baselineCompleteness, evidence: "Completed baselines across the current caseload" },
    { domain: COACH_AUDIT_DOMAINS[1], metric: metrics.measurementQuality, evidence: "Versioned, non-legacy screening records" },
    { domain: COACH_AUDIT_DOMAINS[2], metric: metrics.goalQuality, evidence: "Goals with observable behaviour, cadence and frequency" },
    { domain: COACH_AUDIT_DOMAINS[3], metric: metrics.ifThenPlanning, evidence: "Current goals with an if–then plan" },
    { domain: COACH_AUDIT_DOMAINS[7], metric: metrics.documentation, evidence: "Completed structured sessions with all required fields" },
    { domain: COACH_AUDIT_DOMAINS[8], metric: metrics.mdtCoordination, evidence: "Structured huddles linked to an owned task" },
  ];
  const sessionIds = new Set(sessions.map((session) => session.id));
  const reviewedSessionIds = new Set(reviews.filter((review) => sessionIds.has(review.workflow_id)).map((review) => review.workflow_id));
  const auditCoverage = sessions.length ? Math.round((reviewedSessionIds.size / sessions.length) * 100) : null;
  const humanEvidence = COACH_AUDIT_DOMAINS.map((domain) => {
    const rated = reviews.map((review) => review.ratings[domain.key]).filter((rating) => rating && rating !== "Not applicable");
    const met = rated.filter((rating) => rating === "Met").length;
    return { domain, met, total: rated.length, percent: rated.length ? Math.round((met / rated.length) * 100) : null };
  });

  return <div style={{ display: "grid", gap: 16 }}>
    <div><h2 style={{ fontSize: 18, margin: "0 0 3px" }}>Health Coach quality &amp; outcomes</h2><div style={{ color: "var(--muted)", fontSize: 12.5 }}>Operational metrics use the last {periodDays} days where a time window applies. They measure recorded work—not diagnoses or employee value.</div></div>

    <div style={{ background: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 13px", fontSize: 12 }}><b>Governance note:</b> the percentages in the SOP are draft quality benchmarks pending formal Medical Director/operations approval. This page shows evidence and does not automatically pass, fail or rank a Health Coach.</div>

    <section>
      <div style={{ fontSize: 11, fontWeight: 750, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Operational outcomes</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 10 }}>
        <Metric value={rateText(metrics.scheduledCheckins)} label="Scheduled check-ins completed" detail={`${metrics.scheduledCheckins.met} of ${metrics.scheduledCheckins.total} recorded appointments`} />
        <Metric value={rateText(metrics.responseRate)} label="Recorded response rate" detail={`${metrics.responseRate.met} of ${metrics.responseRate.total} follow-ups with a known outcome`} />
        <Metric value={rateText(metrics.goalCompletion)} label="Goal completion" detail={`${metrics.goalCompletion.met} of ${metrics.goalCompletion.total} current goals`} />
        <Metric value={rateText(metrics.adherence)} label="Adherence" detail={`${metrics.adherence.met} of ${metrics.adherence.total} reviewed actions${adherenceChange == null ? "" : ` · ${adherenceChange >= 0 ? "+" : ""}${adherenceChange} points vs prior period`}`} tone={adherenceChange != null && adherenceChange < 0 ? "var(--amber-text)" : undefined} />
        <Metric value={rateText(metrics.barriersAddressed)} label="Barriers addressed" detail={`${metrics.barriersAddressed.met} of ${metrics.barriersAddressed.total} coded barriers`} />
        <Metric value={rateText(metrics.referralCompletion)} label="Referral completion" detail={`${metrics.referralCompletion.met} of ${metrics.referralCompletion.total} non-cancelled clinical referrals`} />
        <Metric value={metrics.safetyAcknowledgement.averageMinutes == null ? "—" : `${metrics.safetyAcknowledgement.averageMinutes} min`} label="Safety acknowledgement" detail={`${metrics.safetyAcknowledgement.met} of ${metrics.safetyAcknowledgement.total} safety events acknowledged`} />
        <Metric value={rateText(metrics.mdtClosure)} label="MDT task closure" detail={`${metrics.mdtClosure.met} of ${metrics.mdtClosure.total} non-cancelled actions`} />
        <Metric value={auditCoverage == null ? "—" : `${auditCoverage}%`} label="Session audit coverage" detail={`${reviewedSessionIds.size} of ${sessions.length} completed structured sessions reviewed`} />
      </div>
    </section>

    <section style={{ ...box, overflow: "hidden" }}>
      <div style={{ padding: "12px 15px" }}><b style={{ fontSize: 13.5 }}>Automated quality evidence</b><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>Structural checks only. Human judgement remains mandatory for scope, referral appropriateness, safety handling and client experience.</div></div>
      {automated.map(({ domain, metric, evidence }) => <div key={domain.key} style={{ borderTop: "1px solid var(--border)", padding: "10px 15px", display: "flex", alignItems: "center", gap: 12 }}><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, fontWeight: 700 }}>{domain.label}</div><div style={{ color: "var(--muted)", fontSize: 11 }}>{evidence}</div></div><div style={{ textAlign: "right" }}><b style={{ fontSize: 14 }}>{rateText(metric)}</b><div style={{ color: "var(--muted)", fontSize: 10.5 }}>draft reference ≥{domain.draftTarget}%</div></div></div>)}
    </section>

    <section style={{ ...box, padding: 14 }}><div style={{ fontWeight: 750, fontSize: 13.5 }}>Known data gaps</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 9 }}>{[
      ["Dropout/reactivation rate", "Programme exit and reactivation are not yet captured as explicit coaching outcomes."],
      ["Client-reported goal achievement", "A coach-completed goal is not the same as the client's own outcome rating."],
      ["Message volume", "Intentionally excluded: the SOP says volume is not a quality measure."],
    ].map(([title, text]) => <div key={title} style={{ background: "var(--neutral-bg)", borderRadius: 8, padding: 10 }}><b style={{ fontSize: 12 }}>{title}</b><div style={{ color: "var(--muted)", fontSize: 11, marginTop: 3 }}>{text}</div></div>)}</div></section>

    {canReview && <ReviewForm sessions={sessions} />}

    <section style={{ ...box, overflow: "hidden" }}><div style={{ padding: "12px 15px" }}><b style={{ fontSize: 13.5 }}>Human quality reviews</b><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>{reviews.length} immutable review{reviews.length === 1 ? "" : "s"} visible to this viewer.</div></div>{reviews.length > 0 && <div style={{ borderTop: "1px solid var(--border)", padding: "10px 15px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>{humanEvidence.map(({ domain, met, total, percent }) => <div key={domain.key} style={{ background: "var(--neutral-bg)", borderRadius: 8, padding: 9 }}><div style={{ fontSize: 11.5, fontWeight: 700 }}>{domain.label}</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{percent == null ? "—" : `${percent}%`}</div><div style={{ color: "var(--muted)", fontSize: 10.5 }}>{met} of {total} applicable reviews met</div></div>)}</div>}{reviews.length ? reviews.map((review) => <details key={review.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 15px" }}><summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center", listStyle: "none" }}><span style={{ background: review.overall_result === "Meets standard" ? "var(--green-bg)" : review.overall_result === "Clinical review required" ? "var(--red-bg)" : "var(--amber-bg)", color: review.overall_result === "Meets standard" ? "var(--green-text)" : review.overall_result === "Clinical review required" ? "var(--red-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>{review.overall_result}</span><b style={{ fontSize: 12.5 }}>{review.client_name} · session {review.session_number}</b><span style={{ color: "var(--muted)", fontSize: 11 }}>· {review.coach_name} · {new Date(review.reviewed_at).toLocaleDateString("en-GB")}</span></summary><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6, marginTop: 9 }}>{COACH_AUDIT_DOMAINS.map((domain) => <div key={domain.key} style={{ fontSize: 11.5 }}><b>{domain.label}:</b> {review.ratings[domain.key]}</div>)}</div>{review.reviewer_note && <div style={{ marginTop: 8, fontSize: 12 }}><b>Reviewer note:</b> {review.reviewer_note}</div>}<div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 6 }}>Reviewed by {review.reviewer_name}</div></details>) : <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--muted)", fontSize: 12.5 }}>No session quality reviews recorded yet.</div>}</section>
  </div>;
}
