"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveHealthCoachSession } from "@/lib/actions";
import {
  ADHERENCE_REVIEWS, CONSENT_STATUSES, FOLLOWUP_CHANNELS, HANDOFF_DESTINATIONS,
  HANDOFF_URGENCY, SCREENING_DISPOSITIONS, URGENT_CONCERNS,
  coachSessionProgress, type CoachSessionData,
} from "@/lib/coach-session";
import { BARRIER_CATEGORIES } from "@/lib/coach-goals";
import { MARKER_BY_KEY, type MarkerKey } from "@/lib/coach-markers";
import MarkerAssessment from "@/components/MarkerAssessment";
import { COACH_OVERRIDE_REASON_MIN_LENGTH } from "@/lib/coach-access";

export type CoachWorkflowView = {
  id: string; status: string; session_number: number; completion_percent: number;
  check_in: CoachSessionData["check_in"]; review: CoachSessionData["review"];
  barrier: CoachSessionData["barrier"]; action_plan: CoachSessionData["action_plan"];
  closeout: CoachSessionData["closeout"]; completed_by_name: string | null; completed_at: string | null;
};

type Goal = { id: string; name: string; target_per_week: number; confidence: number | null; review_date: string | null };
type Screening = { marker: string; score: number | null; interpretation: string | null; date: string; next_review_date: string | null };

const empty: CoachSessionData = { check_in: {}, review: {}, barrier: {}, action_plan: {}, closeout: {} };
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, background: "#fff" };
const area: React.CSSProperties = { ...field, resize: "vertical", minHeight: 68 };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "9px 14px", background: "var(--ink)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const secondary: React.CSSProperties = { ...primary, border: "1px solid var(--border)", background: "#fff", color: "var(--ink)" };

function ScoreScale({ value, onChange, disabled }: { value?: number; onChange: (value: number) => void; disabled: boolean }) {
  return <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{Array.from({ length: 11 }, (_, score) => {
    const selected = value === score;
    return <button type="button" key={score} disabled={disabled} onClick={() => onChange(score)} style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${selected ? "var(--brand-fill)" : "var(--border)"}`, background: selected ? "var(--brand-tint)" : "#fff", color: selected ? "var(--brand-text)" : "var(--ink)", cursor: disabled ? "default" : "pointer", fontSize: 11, fontWeight: selected ? 800 : 500 }}>{score}</button>;
  })}</div>;
}

export default function HealthCoachSessionWorkspace({
  consultationId, client, sessionNumber, workflow, baseline, dueScreenings, latestScreenings,
  goals, adherence, openBarriers, openReferrals, openSafety, previousSession, gender,
  today, canManage, consultationCompleted, supervisorOverride = false,
}: {
  consultationId: string;
  client: { id: string; name: string; code: string | null };
  sessionNumber: number;
  workflow: CoachWorkflowView | null;
  baseline: { status: string; completion_percent: number; updated_at: string } | null;
  dueScreenings: MarkerKey[];
  latestScreenings: Screening[];
  goals: Goal[];
  adherence: { completed: number; missed: number; excused: number; percent: number | null };
  openBarriers: { id: string; category: string; detail: string }[];
  openReferrals: { id: string; destination_role: string; urgency: string; reason: string; status: string }[];
  openSafety: { id: string; trigger_type: string; status: string }[];
  previousSession: { session_number: number; closeout: CoachSessionData["closeout"]; action_plan: CoachSessionData["action_plan"]; completed_at: string | null } | null;
  gender?: string | null;
  today: string;
  canManage: boolean;
  consultationCompleted: boolean;
  supervisorOverride?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<CoachSessionData>(() => workflow ? {
    check_in: workflow.check_in ?? {}, review: workflow.review ?? {}, barrier: workflow.barrier ?? {},
    action_plan: workflow.action_plan ?? {}, closeout: workflow.closeout ?? {},
  } : empty);
  const [busy, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const completed = workflow?.status === "Completed" || consultationCompleted;
  const locked = completed || !canManage;
  const progress = useMemo(() => coachSessionProgress(data, dueScreenings.length), [data, dueScreenings.length]);
  const urgent = progress.urgent;
  const set = <K extends keyof CoachSessionData>(section: K, key: keyof CoachSessionData[K], value: unknown) => setData((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const latest = new Map<string, Screening>();
  for (const screening of latestScreenings) if (!latest.has(screening.marker)) latest.set(screening.marker, screening);

  const save = (intent: "Draft" | "Completed") => {
    setMessage(""); setError("");
    const form = new FormData();
    form.set("consultation_id", consultationId); form.set("intent", intent); form.set("session", JSON.stringify(data));
    if (supervisorOverride) form.set("override_reason", overrideReason.trim());
    start(async () => {
      const result = await saveHealthCoachSession(form);
      if (result?.error) { setError(`${result.error}${result.missing?.length ? ` Missing: ${result.missing.join(", ")}.` : ""}`); return; }
      setMessage(result?.completed ? "Session completed and added to the client timeline." : "Session draft saved.");
      router.refresh();
    });
  };

  const sectionTitle = (number: number, title: string, hint: string) => <div style={{ display: "flex", gap: 10, alignItems: "start", marginBottom: 12 }}><span style={{ width: 26, height: 26, borderRadius: 999, background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800 }}>{number}</span><div><div style={{ fontWeight: 750, fontSize: 14 }}>{title}</div><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 1 }}>{hint}</div></div></div>;
  const label = (title: string, child: React.ReactNode, hint?: string) => <label style={{ display: "grid", gap: 4, fontSize: 12.5 }}><b>{title}</b>{hint && <span style={{ color: "var(--muted)", fontSize: 10.5 }}>{hint}</span>}{child}</label>;

  return <div style={{ maxWidth: 1180 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <div><Link href="/workspace?role=coach" style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12.5, fontWeight: 650 }}>← Health Coach workspace</Link><h1 style={{ fontSize: 20, margin: "7px 0 2px" }}>🌿 Health Coach session {sessionNumber}</h1><div style={{ color: "var(--muted)", fontSize: 12.5 }}>{client.name}{client.code ? ` · ${client.code}` : ""}</div></div>
      <span style={{ flex: 1 }} />
      <span style={{ background: completed ? "var(--green-bg)" : "var(--neutral-bg)", color: completed ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "5px 11px", fontSize: 11.5, fontWeight: 750 }}>{workflow?.status ?? (consultationCompleted ? "Completed legacy consultation" : "Not started")} · {progress.percent}%</span>
      <Link href={`/clients/${client.id}?tab=overview`} style={{ ...secondary, textDecoration: "none" }}>Open client Overview</Link>
    </div>

    {openSafety.length > 0 && <div style={{ ...box, padding: "11px 14px", marginBottom: 12, background: "var(--red-bg)", borderColor: "var(--red-text)", color: "var(--red-text)" }}><b>Safety hard stop is open</b><div style={{ fontSize: 12, marginTop: 3 }}>{openSafety.map((event) => `${event.trigger_type} · ${event.status}`).join("; ")}. Routine coaching must not continue until the designated clinician manages the safety pathway.</div></div>}

    <section style={{ ...box, padding: "15px 17px", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "start", flexWrap: "wrap" }}><div style={{ flex: 1, minWidth: 220 }}><b>Pre-session snapshot</b><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>Read first; ask only what changed.</div></div><span style={{ fontSize: 11.5, fontWeight: 700, color: baseline?.status === "Completed" ? "var(--green-text)" : "var(--amber-text)" }}>Baseline: {baseline ? `${baseline.status} · ${baseline.completion_percent}%` : "not started"}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 12 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}><b style={{ fontSize: 12 }}>Active goals · {goals.length}</b>{goals.length ? goals.slice(0, 4).map((goal) => <div key={goal.id} style={{ fontSize: 11.5, marginTop: 5 }}>{goal.name} · {goal.target_per_week}x/week{goal.review_date ? ` · review ${goal.review_date}` : ""}</div>) : <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 5 }}>No active coaching goal.</div>}</div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}><b style={{ fontSize: 12 }}>Recorded adherence</b><div style={{ fontSize: 18, fontWeight: 800, marginTop: 5 }}>{adherence.percent == null ? "—" : `${adherence.percent}%`}</div><div style={{ color: "var(--muted)", fontSize: 11 }}>Completed {adherence.completed} · missed {adherence.missed} · excused {adherence.excused}</div></div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}><b style={{ fontSize: 12 }}>Open coordination</b><div style={{ fontSize: 11.5, marginTop: 5 }}>{openBarriers.length} barrier{openBarriers.length === 1 ? "" : "s"} · {openReferrals.length} referral{openReferrals.length === 1 ? "" : "s"} · {openSafety.length} safety event{openSafety.length === 1 ? "" : "s"}</div>{openReferrals.slice(0, 2).map((referral) => <div key={referral.id} style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 4 }}>{referral.urgency} → {referral.destination_role}: {referral.reason}</div>)}</div>
        <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}><b style={{ fontSize: 12 }}>Previous session</b>{previousSession ? <><div style={{ fontSize: 11.5, marginTop: 5 }}>{previousSession.action_plan.action_name || "No action recorded"}</div><div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 3 }}>{previousSession.closeout.client_recap || "No client recap recorded"}</div></> : <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 5 }}>This is the first structured session.</div>}</div>
      </div>
    </section>

    {dueScreenings.length > 0 && <section style={{ ...box, padding: "15px 17px", marginBottom: 14, background: "var(--amber-bg)" }}><b style={{ fontSize: 13 }}>{dueScreenings.length} screening{dueScreenings.length === 1 ? "" : "s"} need a decision today</b><div style={{ color: "var(--amber-text)", fontSize: 11.5, marginTop: 3 }}>Complete the approved tool where appropriate, or document why it was scheduled/deferred.</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8, marginTop: 9 }}>{dueScreenings.map((key) => { const marker = MARKER_BY_KEY[key]; const result = latest.get(key); return <div key={key} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 9, padding: 9 }}><div style={{ display: "flex", gap: 7, alignItems: "center" }}><b style={{ flex: 1, fontSize: 12 }}>{marker.icon} {marker.tool}</b>{!locked && <MarkerAssessment clientId={client.id} marker={key} tool={marker.tool} range={marker.range} gender={gender} supervisorOverride={supervisorOverride} />}</div>{result && <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 4 }}>Last: {result.date} · {result.score} · {result.interpretation}</div>}</div>; })}</div></section>}

    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ ...box, padding: 17 }}>{sectionTitle(1, "Connect, set the agenda and check safety", "Begin with the client’s priority; do not start with the coach’s checklist.")}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>{label("Wellbeing today · 0–10", <ScoreScale value={data.check_in.wellbeing} onChange={(value) => set("check_in", "wellbeing", value)} disabled={locked} />)}{label("Energy today · 0–10", <ScoreScale value={data.check_in.energy} onChange={(value) => set("check_in", "energy", value)} disabled={locked} />)}{label("What would make this session useful?", <textarea disabled={locked} value={data.check_in.client_priority ?? ""} onChange={(event) => set("check_in", "client_priority", event.target.value)} style={area} />)}{label("Any new urgent concern?", <select disabled={locked} value={data.check_in.urgent_concern ?? ""} onChange={(event) => set("check_in", "urgent_concern", event.target.value)} style={field}><option value="">Select…</option>{URGENT_CONCERNS.map((value) => <option key={value}>{value}</option>)}</select>)}</div>{urgent && <div style={{ marginTop: 12, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 9, padding: 11 }}><b>Stop routine coaching and escalate now</b><textarea disabled={locked} required value={data.check_in.immediate_action ?? ""} onChange={(event) => set("check_in", "immediate_action", event.target.value)} placeholder="Who was contacted, what was done, and how the client was kept safe" style={{ ...area, marginTop: 7 }} /></div>}</section>

      {!urgent && <>
        <section style={{ ...box, padding: 17 }}>{sectionTitle(2, "Review progress without judgement", "Use recorded evidence, notice wins, and let the client explain what happened.")}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>{label("Wins since the last contact", <textarea disabled={locked} value={data.review.wins ?? ""} onChange={(event) => set("review", "wins", event.target.value)} style={area} />)}{label("Adherence review", <select disabled={locked} value={data.review.adherence ?? ""} onChange={(event) => set("review", "adherence", event.target.value)} style={field}><option value="">Select…</option>{ADHERENCE_REVIEWS.map((value) => <option key={value}>{value}</option>)}</select>)}{label("Evidence used", <textarea disabled={locked} value={data.review.evidence ?? ""} onChange={(event) => set("review", "evidence", event.target.value)} placeholder="Client report, app check-offs, wearable, food log…" style={area} />)}{label("What did the client learn?", <textarea disabled={locked} value={data.review.learning ?? ""} onChange={(event) => set("review", "learning", event.target.value)} style={area} />)}</div>{dueScreenings.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 12 }}>{label("Due-screening decision", <select disabled={locked} value={data.review.screening_disposition ?? ""} onChange={(event) => set("review", "screening_disposition", event.target.value)} style={field}><option value="">Select…</option>{SCREENING_DISPOSITIONS.map((value) => <option key={value}>{value}</option>)}</select>)}{label("Screening note", <input disabled={locked} value={data.review.screening_note ?? ""} onChange={(event) => set("review", "screening_note", event.target.value)} placeholder="What was completed, scheduled or deferred, and why" style={field} />)}</div>}</section>

        <section style={{ ...box, padding: 17 }}>{sectionTitle(3, "Explore the barrier and choose a response", "Record a barrier when it affected follow-through; do not label the client as non-compliant.")}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>{label("Barrier category", <select disabled={locked} value={data.barrier.category ?? ""} onChange={(event) => set("barrier", "category", event.target.value)} style={field}><option value="">No new barrier</option>{BARRIER_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select>)}{label("What got in the way?", <textarea disabled={locked} value={data.barrier.detail ?? ""} onChange={(event) => set("barrier", "detail", event.target.value)} style={area} />)}{label("Agreed coach response or experiment", <textarea disabled={locked} value={data.barrier.coach_response ?? ""} onChange={(event) => set("barrier", "coach_response", event.target.value)} style={area} />)}</div>{data.review.adherence === "Off track" && !data.barrier.detail && <div style={{ color: "var(--amber-text)", fontSize: 11.5, fontWeight: 700, marginTop: 8 }}>Off-track progress needs a barrier and an agreed response.</div>}</section>

      <section style={{ ...box, padding: 17 }}>{sectionTitle(4, "Agree one measurable action", "The plan belongs to the client and becomes the active coaching goal after closeout.")}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>{label("Continue an existing goal", <select disabled={locked} value={data.action_plan.goal_id ?? ""} onChange={(event) => { const goal = goals.find((item) => item.id === event.target.value); set("action_plan", "goal_id", event.target.value); if (goal) { set("action_plan", "action_name", goal.name); set("action_plan", "target_per_week", goal.target_per_week); } }} style={field}><option value="">Create a new goal from this plan</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select>)}{label("Specific agreed action", <input disabled={locked} value={data.action_plan.action_name ?? ""} onChange={(event) => set("action_plan", "action_name", event.target.value)} style={field} />)}{label("Times per week", <input disabled={locked} type="number" min={1} max={7} value={data.action_plan.target_per_week ?? ""} onChange={(event) => set("action_plan", "target_per_week", Number(event.target.value))} style={field} />)}{label("Cue", <input disabled={locked} value={data.action_plan.cue ?? ""} onChange={(event) => set("action_plan", "cue", event.target.value)} placeholder="After / before what?" style={field} />)}{label("Time and place", <input disabled={locked} value={data.action_plan.time_place ?? ""} onChange={(event) => set("action_plan", "time_place", event.target.value)} style={field} />)}{label("Confidence · 0–10", <ScoreScale value={data.action_plan.confidence} onChange={(value) => set("action_plan", "confidence", value)} disabled={locked} />)}{label("If–then recovery plan", <textarea disabled={locked} value={data.action_plan.if_then_plan ?? ""} onChange={(event) => set("action_plan", "if_then_plan", event.target.value)} placeholder="If the usual barrier happens, then…" style={area} />)}{label("Support needed", <textarea disabled={locked} value={data.action_plan.support_needed ?? ""} onChange={(event) => set("action_plan", "support_needed", event.target.value)} style={area} />)}{label("Review date", <input disabled={locked} type="date" min={today} value={data.action_plan.review_date ?? ""} onChange={(event) => set("action_plan", "review_date", event.target.value)} style={field} />)}</div>{data.action_plan.confidence != null && data.action_plan.confidence < 7 && <div style={{ marginTop: 12, background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 9, padding: 10 }}><b style={{ fontSize: 12 }}>Confidence is below 7 — make the action smaller</b><textarea disabled={locked} value={data.action_plan.scale_down_note ?? ""} onChange={(event) => set("action_plan", "scale_down_note", event.target.value)} placeholder="Record the smaller version the client feels able to do" style={{ ...area, marginTop: 6 }} /></div>}</section>
      </>}

      <section style={{ ...box, padding: 17 }}>{sectionTitle(5, urgent ? "Document the safety closeout" : "Close, confirm and arrange follow-up", urgent ? "Record the handover and next contact; no routine behaviour plan is required." : "Ask the client to say the plan back in their own words.")}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>{!urgent && label("Client’s own recap", <textarea disabled={locked} value={data.closeout.client_recap ?? ""} onChange={(event) => set("closeout", "client_recap", event.target.value)} style={area} />)}{label("Coach summary", <textarea disabled={locked} value={data.closeout.coach_summary ?? ""} onChange={(event) => set("closeout", "coach_summary", event.target.value)} style={area} />)}{!urgent && label("Follow-up channel", <select disabled={locked} value={data.closeout.followup_channel ?? ""} onChange={(event) => set("closeout", "followup_channel", event.target.value)} style={field}><option value="">Select…</option>{FOLLOWUP_CHANNELS.map((value) => <option key={value}>{value}</option>)}</select>)}{label("Follow-up date", <input disabled={locked} type="date" min={today} value={data.closeout.followup_date ?? ""} onChange={(event) => set("closeout", "followup_date", event.target.value)} style={field} />)}{!urgent && label("Warm handoff needed?", <select disabled={locked} value={data.closeout.handoff_needed ?? ""} onChange={(event) => set("closeout", "handoff_needed", event.target.value)} style={field}><option value="">Select…</option><option>Yes</option><option>No</option></select>)}</div>{!urgent && data.closeout.handoff_needed === "Yes" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12, background: "var(--amber-bg)", padding: 11, borderRadius: 9 }}>{label("Destination", <select disabled={locked} value={data.closeout.handoff_destination ?? ""} onChange={(event) => set("closeout", "handoff_destination", event.target.value)} style={field}><option value="">Select…</option>{HANDOFF_DESTINATIONS.map((value) => <option key={value}>{value}</option>)}</select>)}{label("Urgency", <select disabled={locked} value={data.closeout.handoff_urgency ?? ""} onChange={(event) => set("closeout", "handoff_urgency", event.target.value)} style={field}><option value="">Select…</option>{HANDOFF_URGENCY.map((value) => <option key={value}>{value}</option>)}</select>)}{label("Consent", <select disabled={locked} value={data.closeout.consent_status ?? ""} onChange={(event) => set("closeout", "consent_status", event.target.value)} style={field}><option value="">Select…</option>{CONSENT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>)}{label("Reason and requested help", <textarea disabled={locked} value={data.closeout.handoff_reason ?? ""} onChange={(event) => set("closeout", "handoff_reason", event.target.value)} style={area} />)}</div>}{data.closeout.consent_status === "Declined" && <div style={{ color: "var(--amber-text)", fontSize: 11.5, marginTop: 7 }}>The declined handoff will be documented but not sent automatically.</div>}</section>
    </div>

    <div style={{ ...box, position: "sticky", bottom: 10, padding: "11px 14px", marginTop: 14, display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", zIndex: 4 }}>{supervisorOverride && canManage && !completed && <label style={{ flex: "1 1 300px", display: "grid", gap: 3, color: "var(--amber-text)", fontSize: 10.5 }}>Supervisor override reason<input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} required minLength={COACH_OVERRIDE_REASON_MIN_LENGTH} placeholder="Why the assigned coach cannot run this session" style={field} /></label>}<div style={{ flex: 1, minWidth: 230 }}><div style={{ height: 7, background: "var(--neutral-bg)", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${progress.percent}%`, height: "100%", background: progress.percent === 100 ? "var(--green-text)" : "var(--brand-fill)" }} /></div><div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 3 }}>{progress.percent}% · {progress.missing.length ? `Still needed: ${progress.missing.slice(0, 4).join(", ")}${progress.missing.length > 4 ? "…" : ""}` : "Ready to close"}</div></div>{error && <span style={{ color: "var(--red-text)", fontSize: 11.5, maxWidth: 420 }}>{error}</span>}{message && <span style={{ color: "var(--green-text)", fontSize: 11.5, fontWeight: 700 }}>{message}</span>}{completed ? <Link href={`/clients/${client.id}?tab=timeline`} style={{ ...primary, textDecoration: "none" }}>View timeline →</Link> : canManage ? <><button type="button" disabled={busy || (urgent && !data.check_in.immediate_action) || (supervisorOverride && overrideReason.trim().length < COACH_OVERRIDE_REASON_MIN_LENGTH)} onClick={() => save("Draft")} style={{ ...secondary, opacity: busy ? .55 : 1 }}>{busy ? "Saving…" : "Save draft"}</button><button type="button" disabled={busy || progress.percent !== 100 || (supervisorOverride && overrideReason.trim().length < COACH_OVERRIDE_REASON_MIN_LENGTH)} onClick={() => save("Completed")} style={{ ...primary, opacity: busy || progress.percent !== 100 || (supervisorOverride && overrideReason.trim().length < COACH_OVERRIDE_REASON_MIN_LENGTH) ? .5 : 1 }}>{urgent ? "Record safety closeout" : "Complete session"}</button></> : <span style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 700 }}>Read-only care-team view</span>}</div>
  </div>;
}
