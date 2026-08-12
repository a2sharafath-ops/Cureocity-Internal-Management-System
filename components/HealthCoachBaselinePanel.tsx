"use client";

import { useMemo, useState, useTransition } from "react";
import { saveCoachBaseline } from "@/lib/actions";
import {
  BASELINE_MODULES, baselineProgress, questionIsVisible, triggeredBaselinePathways,
  type BaselineAnswers, type BaselineQuestion,
} from "@/lib/coach-baseline";
import { applicableMarkerKeys, MARKER_BY_KEY, MARKERS } from "@/lib/coach-markers";
import MarkerAssessment from "@/components/MarkerAssessment";
import { COACH_OVERRIDE_REASON_MIN_LENGTH } from "@/lib/coach-access";

export type CoachBaselineView = {
  id: string; version: string; status: string; answers: BaselineAnswers;
  triggered_pathways: string[]; completion_percent: number;
  completed_by_name: string | null; completed_at: string | null; updated_at: string;
};

export type ScreeningResultView = {
  id: string; marker: string; score: number | null; band: string | null; tone: string | null;
  date: string; instrument: string | null; instrument_version: string | null;
  interpretation: string | null; recommended_action: string | null;
  reviewer_name: string | null; next_review_date: string | null; source_url: string | null;
};

const field: React.CSSProperties = { width: "100%", minHeight: 36, boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", background: "#fff", fontSize: 12.5 };
const primary: React.CSSProperties = { border: 0, borderRadius: 8, padding: "8px 13px", background: "var(--ink)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const secondary: React.CSSProperties = { ...primary, border: "1px solid var(--border)", background: "#fff", color: "var(--ink)" };

function Question({ question, value, setValue }: { question: BaselineQuestion; value: string | number | null | undefined; setValue: (value: string | number | null) => void }) {
  return <label style={{ display: "grid", gap: 4, fontSize: 12.5 }}>
    <span style={{ fontWeight: 600 }}>{question.text}{question.required ? " *" : ""}</span>
    {question.help && <span style={{ color: "var(--muted)", fontSize: 10.5 }}>{question.help}</span>}
    {question.type === "select" ? <select value={String(value ?? "")} onChange={(event) => setValue(event.target.value || null)} style={field}><option value="">Select…</option>{question.options?.map((option) => <option key={option}>{option}</option>)}</select>
      : question.type === "scale" ? <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{Array.from({ length: (question.max ?? 10) - (question.min ?? 0) + 1 }, (_, index) => index + (question.min ?? 0)).map((number) => <button type="button" key={number} onClick={() => setValue(number)} style={{ width: 31, height: 31, borderRadius: 999, border: `1px solid ${Number(value) === number ? "var(--brand-fill)" : "var(--border)"}`, background: Number(value) === number ? "var(--brand-tint)" : "#fff", color: Number(value) === number ? "var(--brand-text)" : "var(--ink)", cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>{number}</button>)}</div>
      : question.type === "text" ? <textarea value={String(value ?? "")} onChange={(event) => setValue(event.target.value)} rows={2} style={{ ...field, resize: "vertical" }} />
      : <input type={question.type} min={question.min} max={question.max} value={value ?? ""} onChange={(event) => setValue(event.target.value === "" ? null : question.type === "number" ? Number(event.target.value) : event.target.value)} style={field} />}
  </label>;
}

export default function HealthCoachBaselinePanel({ clientId, baseline, screenings, canManage, gender, supervisorOverride = false }: {
  clientId: string; baseline: CoachBaselineView | null; screenings: ScreeningResultView[];
  canManage: boolean; gender?: string | null; supervisorOverride?: boolean;
}) {
  const [answers, setAnswers] = useState<BaselineAnswers>(baseline?.answers ?? {});
  const [editing, setEditing] = useState(!baseline);
  const [message, setMessage] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, start] = useTransition();
  const progress = useMemo(() => baselineProgress(answers), [answers]);
  const pathways = useMemo(() => triggeredBaselinePathways(answers), [answers]);
  const latest = new Map<string, ScreeningResultView>();
  for (const result of screenings) if (!latest.has(result.marker)) latest.set(result.marker, result);
  const applicableMarkers = applicableMarkerKeys(pathways, latest.keys());
  const triggeredMarkers = applicableMarkerKeys(pathways, []);

  const save = (intent: "Draft" | "Completed") => {
    const form = new FormData();
    form.set("client_id", clientId);
    form.set("answers", JSON.stringify(answers));
    form.set("intent", intent);
    if (supervisorOverride) form.set("override_reason", overrideReason.trim());
    start(async () => {
      await saveCoachBaseline(form);
      setMessage(intent === "Completed" && progress.percent === 100 ? "Baseline completed." : "Draft saved.");
      if (intent === "Completed" && progress.percent === 100) setEditing(false);
    });
  };

  return <section id="coach-baseline" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 240 }}><div style={{ fontWeight: 750 }}>Health Coach 360° baseline</div><div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Structured context first; validated screening opens only when the recorded answers indicate it.</div></div>
      <span style={{ borderRadius: 999, padding: "4px 10px", background: progress.percent === 100 ? "var(--green-bg)" : "var(--neutral-bg)", color: progress.percent === 100 ? "var(--green-text)" : "var(--muted)", fontSize: 11.5, fontWeight: 750 }}>{baseline?.status ?? "Not started"} · {progress.percent}%</span>
      {canManage && !editing && <button type="button" onClick={() => setEditing(true)} style={secondary}>Review / update</button>}
    </div>

    <div style={{ height: 7, borderRadius: 999, background: "var(--neutral-bg)", marginTop: 12, overflow: "hidden" }}><div style={{ height: "100%", width: `${progress.percent}%`, background: progress.percent === 100 ? "var(--green-text)" : "var(--brand-fill)", transition: "width .2s" }} /></div>
    <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 4 }}>{progress.completed} of {progress.total} applicable required answers recorded{baseline?.completed_at ? ` · completed by ${baseline.completed_by_name ?? "coach"}` : ""}</div>

    {editing && canManage && <div style={{ marginTop: 14 }}>
      {supervisorOverride && <label style={{ display: "grid", gap: 4, marginBottom: 12, color: "var(--amber-text)", fontSize: 12 }}>
        Supervisor override reason
        <input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} required minLength={COACH_OVERRIDE_REASON_MIN_LENGTH} placeholder="Why the assigned coach cannot update this baseline" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "#fff" }} />
        <span style={{ fontSize: 10.5 }}>This reason is written to the audit log.</span>
      </label>}
      <div style={{ display: "grid", gap: 9 }}>
        {BASELINE_MODULES.map((module) => {
          const visible = module.questions.filter((question) => questionIsVisible(question, answers));
          const missing = visible.filter((question) => question.required && progress.missing.includes(question.id)).length;
          return <details key={module.key} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }} open={module.key === "communication" && !baseline}>
            <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}><b>{module.title}</b><span style={{ color: "var(--muted)", fontSize: 11.5 }}>· {module.purpose}</span><span style={{ flex: 1 }} />{missing > 0 ? <span style={{ color: "var(--amber-text)", fontSize: 10.5, fontWeight: 700 }}>{missing} missing</span> : <span style={{ color: "var(--green-text)", fontSize: 10.5, fontWeight: 700 }}>Complete</span>}</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>{visible.map((question) => <Question key={question.id} question={question} value={answers[question.id]} setValue={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />)}</div>
            {module.key === "motivation" && Number(answers.confidence) < 7 && answers.confidence !== null && answers.confidence !== undefined && <div style={{ marginTop: 10, background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 650 }}>Confidence is below 7: make the first step smaller and address the barrier before finalising the goal.</div>}
          </details>;
        })}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" onClick={() => save("Draft")} disabled={busy || (supervisorOverride && overrideReason.trim().length < COACH_OVERRIDE_REASON_MIN_LENGTH)} style={secondary}>{busy ? "Saving…" : "Save draft"}</button>
        <button type="button" onClick={() => save("Completed")} disabled={busy || progress.percent !== 100 || (supervisorOverride && overrideReason.trim().length < COACH_OVERRIDE_REASON_MIN_LENGTH)} style={{ ...primary, opacity: busy || progress.percent !== 100 || (supervisorOverride && overrideReason.trim().length < COACH_OVERRIDE_REASON_MIN_LENGTH) ? .5 : 1 }}>{progress.percent === 100 ? "Complete baseline" : `${progress.missing.length} answers remaining`}</button>
        {baseline && <button type="button" onClick={() => { setAnswers(baseline.answers); setEditing(false); }} style={{ ...secondary, color: "var(--muted)" }}>Cancel</button>}
        {message && <span style={{ color: "var(--green-text)", fontSize: 12, fontWeight: 650 }}>{message}</span>}
      </div>
    </div>}

    {pathways.length > 0 && <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>Triggered pathways</div>
      <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>These are workflow prompts, not diagnoses. The coach records the approved tool or routes to the appropriate professional.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{pathways.map((pathway) => <span key={pathway} style={{ background: pathway.startsWith("Urgent") ? "var(--red-bg)" : "var(--amber-bg)", color: pathway.startsWith("Urgent") ? "var(--red-text)" : "var(--amber-text)", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>{pathway}</span>)}</div>
      {pathways.includes("Urgent alcohol/withdrawal clinical review") && <div style={{ marginTop: 9, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "9px 11px", fontSize: 12, fontWeight: 700 }}>Do not advise abrupt alcohol cessation. Open a clinical referral for assessment.</div>}
      {triggeredMarkers.size > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 10, marginTop: 10 }}>{Array.from(triggeredMarkers).map((key) => {
        const marker = MARKER_BY_KEY[key];
        const result = latest.get(key);
        return <div key={key} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 10 }}><div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 6 }}><b style={{ fontSize: 12.5 }}>{marker.icon} {marker.label}</b><span style={{ color: "var(--muted)", fontSize: 11 }}>{result ? `last ${result.date} · ${result.score} · ${result.interpretation ?? result.band}` : "not recorded"}</span></div>{canManage && <MarkerAssessment clientId={clientId} marker={key} tool={marker.tool} range={marker.range} gender={gender} supervisorOverride={supervisorOverride} />}</div>;
      })}</div>}
    </div>}

    <details style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Screening record ({screenings.length})</summary>
      <div style={{ display: "grid", gap: 7, marginTop: 9 }}>{MARKERS.map((marker) => {
        const result = latest.get(marker.key);
        return <div key={marker.key} style={{ display: "flex", alignItems: "start", gap: 9, borderTop: "1px solid var(--border)", paddingTop: 7, fontSize: 12 }}><span>{marker.icon}</span><div style={{ flex: 1 }}><b>{marker.label}</b><span style={{ color: applicableMarkers.has(marker.key) ? "var(--amber-text)" : "var(--muted)", fontSize: 10.5, fontWeight: 700 }}> · {applicableMarkers.has(marker.key) ? "applicable" : "not currently indicated"}</span>{result ? <><span style={{ color: "var(--muted)" }}> · {result.instrument ?? marker.tool} · {result.date} · score {result.score ?? "—"} · {result.interpretation ?? result.band ?? "—"}</span>{result.recommended_action && <div style={{ marginTop: 2 }}>{result.recommended_action}</div>}<div style={{ color: "var(--muted)", fontSize: 10.5 }}>Version: {result.instrument_version ?? "not recorded"} · reviewer: {result.reviewer_name ?? "not recorded"} · next review: {result.next_review_date ?? "not set"}</div></> : <span style={{ color: "var(--muted)" }}> · no result</span>}</div>{canManage && !triggeredMarkers.has(marker.key) && <MarkerAssessment clientId={clientId} marker={marker.key} tool={marker.tool} range={marker.range} gender={gender} supervisorOverride={supervisorOverride} />}</div>;
      })}</div>
    </details>
  </section>;
}
