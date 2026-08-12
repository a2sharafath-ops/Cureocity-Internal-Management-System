"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCoachAssessment } from "@/lib/actions";
import { bandFor, TONE_STYLE, type MarkerKey } from "@/lib/coach-markers";
import { INSTRUMENTS, instrumentIsComplete, visibleInstrumentItems } from "@/lib/coach-instruments";

export default function MarkerAssessment({ clientId, marker, tool, range, gender }: {
  clientId: string; marker: MarkerKey; tool: string; range: string; gender?: string | null;
}) {
  const instrument = INSTRUMENTS[marker];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [manual, setManual] = useState("");
  const [externalResult, setExternalResult] = useState("");
  const [note, setNote] = useState("");
  const [safetyAction, setSafetyAction] = useState("");
  const [busy, start] = useTransition();

  const applicableItems = instrument ? visibleInstrumentItems(instrument, answers) : [];
  const complete = instrument
    ? instrumentIsComplete(instrument, answers, externalResult)
    : manual.trim() !== "";
  const computed = instrument?.compute && complete ? instrument.compute(answers) : null;
  const score = instrument?.mode === "external" ? Number(externalResult) : instrument ? computed?.score ?? Number.NaN : Number(manual);
  const substanceAction = marker === "substance" && Boolean(computed && (computed.detail.dast >= 3 || computed.detail.fagerstrom >= 3));
  const officialFollowup = marker === "activity" && externalResult === "Follow-up required";
  const safetyTrigger = Boolean(computed?.safetyTrigger);
  const forceBad = substanceAction || officialFollowup;
  const validScore = complete && Number.isFinite(score)
    && (!instrument || (score >= instrument.scoreMin && score <= instrument.scoreMax));
  const band = validScore ? bandFor(marker, score, gender) : null;
  // A first high PSS-10 is a repeat cue, not an immediate referral. The server
  // checks the prior result and marks the saved record as sustained when this
  // is the second consecutive high score.
  const firstHighStress = marker === "stress" && validScore && score >= 27;
  const tone = forceBad ? "bad" : firstHighStress ? "warn" : band?.tone ?? null;
  const bandLabel = forceBad ? "Action required" : firstHighStress ? "High · repeat next session" : band?.label ?? "—";
  const toneStyle = tone && TONE_STYLE[tone as keyof typeof TONE_STYLE]
    ? TONE_STYLE[tone as keyof typeof TONE_STYLE]
    : { bg: "var(--neutral-bg)", text: "var(--muted)" };

  const reset = () => { setOpen(false); setAnswers({}); setManual(""); setExternalResult(""); setNote(""); setSafetyAction(""); };
  const save = () => {
    if (!validScore || (safetyTrigger && !safetyAction.trim())) return;
    const detail = instrument?.mode === "external"
      ? { official_score: score, external_result: externalResult }
      : { ...(computed?.detail ?? { manual: score }), answers, external_result: externalResult || null };
    const form = new FormData();
    form.set("client_id", clientId);
    form.set("marker", marker);
    form.set("score", String(score));
    form.set("detail", JSON.stringify(detail));
    if (forceBad) form.set("force_bad", "1");
    if (safetyTrigger) form.set("safety_trigger", "1");
    if (safetyAction.trim()) form.set("immediate_action", safetyAction.trim());
    if (note.trim()) form.set("note", note.trim());
    start(async () => { await saveCoachAssessment(form); reset(); router.refresh(); });
  };

  const input: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 12.5, background: "#fff" };
  const toHHMM = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const fromHHMM = (value: string) => { const [hours, minutes] = value.split(":").map(Number); return (hours || 0) * 60 + (minutes || 0); };

  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)" }}>＋ Assess</button>;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--bg, #fafafa)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 12.5 }}>{instrument?.title ?? `${tool} (${range})`}</b>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={reset} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>✕</button>
      </div>

      {instrument && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
        <div>{instrument.instruction}</div>
        <div style={{ marginTop: 3 }}><b>Version:</b> {instrument.version}</div>
        <a href={instrument.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--brand-text)", fontWeight: 650 }}>Open official source ↗</a>
        {instrument.permissionNote && <div style={{ marginTop: 5, color: "var(--amber-text)" }}>{instrument.permissionNote}</div>}
      </div>}

      {instrument?.mode === "external" ? (
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>Verified official-form global score
          <input type="number" min={instrument.scoreMin} max={instrument.scoreMax} value={externalResult} onChange={(event) => setExternalResult(event.target.value)} style={{ ...input, width: 160 }} />
        </label>
      ) : (
        <>
          {instrument?.mode === "hybrid" && <label style={{ display: "grid", gap: 4, fontSize: 12, marginBottom: 9 }}>{instrument.externalResultLabel}
            <select value={externalResult} onChange={(event) => setExternalResult(event.target.value)} style={{ ...input, maxWidth: 260 }}><option value="">Select official result…</option>{instrument.externalResultOptions?.map((option) => <option key={option}>{option}</option>)}</select>
          </label>}
          {instrument ? <div style={{ display: "grid", gap: 8, maxHeight: 390, overflow: "auto", paddingRight: 4 }}>
            {applicableItems.map((item) => <div key={item.id}>
              <div style={{ fontSize: 12, marginBottom: 3 }}>{item.text}</div>
              {item.kind === "opt" ? <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{item.options!.map((option) => {
                const selected = answers[item.id] === option.v;
                return <button type="button" key={option.label} onClick={() => setAnswers((current) => ({ ...current, [item.id]: option.v }))} style={{ border: `1px solid ${selected ? "var(--brand-fill)" : "var(--border)"}`, background: selected ? "var(--brand-tint)" : "#fff", color: selected ? "var(--brand-text)" : "var(--ink)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{option.label}</button>;
              })}</div> : item.kind === "time" ? <input type="time" value={answers[item.id] != null ? toHHMM(answers[item.id]) : ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: fromHHMM(event.target.value) }))} style={{ ...input, width: 130 }} /> : <input type="number" min={item.min ?? 0} max={item.max} value={answers[item.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: Number(event.target.value) }))} style={{ ...input, width: 130 }} placeholder={item.unit} />}
            </div>)}
          </div> : <input type="number" step="any" value={manual} onChange={(event) => setManual(event.target.value)} placeholder={`Score (${range})`} style={{ ...input, width: 160 }} />}
        </>
      )}

      {instrument && !complete && <div style={{ marginTop: 9, color: "var(--amber-text)", fontSize: 11.5, fontWeight: 650 }}>Complete every applicable item{instrument.mode !== "embedded" ? " and record the official-form result" : ""} before a score can be saved.</div>}
      {officialFollowup && <div style={{ marginTop: 9, padding: "8px 10px", borderRadius: 8, background: "var(--amber-bg)", color: "var(--amber-text)", fontSize: 12, fontWeight: 700 }}>PAR-Q+ follow-up is required. Do not progress exercise; route for the appropriate clinical/qualified exercise-professional review.</div>}
      {safetyTrigger && <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "var(--red-bg)", color: "var(--red-text)" }}>
        <div style={{ fontWeight: 800, fontSize: 12.5 }}>Safety hard stop — do not continue routine coaching</div>
        <div style={{ fontSize: 11.5, margin: "3px 0 7px" }}>Keep the client engaged and alert the designated senior clinician before the session ends. Saving opens a persistent safety event.</div>
        <input value={safetyAction} onChange={(event) => setSafetyAction(event.target.value)} required placeholder="Immediate action taken and person contacted" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
      </div>}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12 }}>Score <b>{validScore ? score : "—"}</b></span>
        {validScore && <span style={{ background: toneStyle.bg, color: toneStyle.text, borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{bandLabel}</span>}
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Context or action taken (optional)" style={{ ...input, flex: 1, minWidth: 170 }} />
        <button type="button" onClick={save} disabled={busy || !validScore || (safetyTrigger && !safetyAction.trim())} style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy || !validScore || (safetyTrigger && !safetyAction.trim()) ? .55 : 1 }}>{busy ? "Saving…" : "Save assessment"}</button>
      </div>
    </div>
  );
}
