"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  type Assessment, type ExerciseRow, type MedicationRow, type StressLevel,
  ACTIVITY_FACTORS, mifflinStJeor, estimateTee, bmiFrom, fatMassFrom, ageOn, assessmentGaps,
} from "@/lib/diet-assessment";
import { saveDietAssessment, submitDietAssessment, reviewDietAssessment, newDietAssessmentVersion } from "@/lib/actions";
import DeliverButton from "@/components/DeliverButton";

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
const inpControl: React.CSSProperties = { ...inp, padding: "0 10px", height: 34, boxSizing: "border-box", width: "100%" };
const label: React.CSSProperties = { fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 4 };
const iconBtn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 12, lineHeight: "26px", padding: 0 };
const outlineBtn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const darkBtn: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const brandBtn: React.CSSProperties = { background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const greenBtn: React.CSSProperties = { background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const amberBtn: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--amber-text)" };
const smallLink: React.CSSProperties = { border: "none", background: "transparent", color: "var(--brand-text)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" };

const disabledOf = (disabled: boolean, s: React.CSSProperties): React.CSSProperties =>
  disabled ? { ...s, opacity: 0.55, cursor: "default" } : s;

const newDietAssessmentVersionForm = async (formData: FormData) => {
  await newDietAssessmentVersion(formData);
};

const statusPill = (status: string) => {
  if (status === "published") return { bg: "var(--green-bg)", fg: "var(--green-text)", text: "Published" };
  if (status === "in_review") return { bg: "var(--blue-bg)", fg: "var(--blue-text)", text: "In review" };
  return { bg: "var(--amber-bg)", fg: "var(--amber-text)", text: "Draft" };
};

/** A blank medication row — a new "+ Add medication" click. */
const blankMedication = (): MedicationRow => ({ medication: "", notes: "" });
/** A blank exercise row — a new "+ Add exercise" click. */
const blankExercise = (): ExerciseRow => ({ type: "", frequency: "", duration: "" });

/** The fields this screen edits, plus the issued date which lives on the same row. */
type FormState = Assessment & { issued_on: string | null };

/** Column names `saveDietAssessment` will actually accept — mirrors the ALLOWED
 *  set in lib/actions.ts so the client only ever offers to save real columns. */
const SAVE_KEYS = [
  "consulted_on", "dietitian", "medical_history", "existing_condition", "medications", "allergies", "family_history",
  "occupation", "daily_activity", "exercise", "sleep_hours", "sleep_quality", "stress_level", "gut_health", "weight_change",
  "diet_type", "food_allergies", "food_dislikes", "supplements",
  "height", "weight", "bmi", "bmr", "tee", "muscle_mass", "fat_mass", "body_fat", "visceral_fat", "waist_hip",
  "primary_goals", "target_weight", "timeline_weeks", "objectives",
  "meal_frequency", "meals_per_day", "snacking", "hydration", "notes", "issued_on",
] as const satisfies readonly (keyof FormState)[];

/**
 * The dietitian's editor for the Dietary Assessment Summary — what was found
 * at consultation, lifestyle and dietary preference, the current health
 * status (with live BMI / TEE / fat-mass arithmetic), goals, intake, and the
 * draft → review → publish lifecycle. Mirrors DietPlanBuilder's structure and
 * conventions; a published assessment renders fully read-only because it is
 * frozen deliberately (see 0129_diet_assessments.sql) — a client's numbers
 * change, and re-drafting would silently rewrite what was found at the time.
 */
export default function DietAssessmentBuilder({
  id, clientId, clientName, status, version, canReview, initial, readOnly = false, sharedAt, pdf, whatsapp,
}: {
  id: string;
  /** Needed only to start a fresh version from a published row — see "New version" below. */
  clientId: string;
  clientName: string;
  status: string;
  version: number;
  /** Can approve/send-back an assessment awaiting sign-off (Super Admin / Administrator). */
  canReview: boolean;
  readOnly?: boolean;
  sharedAt: string | null;
  initial: Assessment & { dob?: string | null; gender?: string | null; issued_on?: string | null };
  /** Whether server-side PDF rendering is configured — see lib/pdf.ts. */
  pdf: { ready: boolean; missing: string[] };
  whatsapp?: { ready: boolean; missing: string[] };
}) {
  const { dob, gender, issued_on, ...assessmentInitial } = initial;
  const initialForm: FormState = { ...assessmentInitial, issued_on: issued_on ?? null };

  const [form, setForm] = useState<FormState>(initialForm);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // What was last confirmed saved — Save diffs against this so the patch sent
  // to the server names only the columns that actually changed.
  const baselineRef = useRef<FormState>(initialForm);

  // A published assessment is a fixed document; a workspace-level read-only
  // view (e.g. an admin previewing a discipline they don't hold) is the same.
  const locked = readOnly || status === "published";

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault(); e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const touch = () => setDirty(true);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    touch();
  }

  // ---- live arithmetic -------------------------------------------------
  // Fat mass has no independent measured figure on this table — weight and
  // body-fat % are the only inputs it has, so it's safe to fully recompute.
  useEffect(() => {
    if (locked) return;
    const fm = fatMassFrom(form.weight, form.body_fat);
    if (fm !== null && fm !== form.fat_mass) setForm((f) => ({ ...f, fat_mass: fm }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.weight, form.body_fat, locked]);

  // TEE is BMR × activity factor with nothing else to reconcile against, so it
  // recomputes fully whenever either input changes.
  useEffect(() => {
    if (locked) return;
    const t = estimateTee(form.bmr, form.daily_activity);
    if (t !== null && t !== form.tee) setForm((f) => ({ ...f, tee: t }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.bmr, form.daily_activity, locked]);

  // BMI, unlike fat mass, can also come from a direct InBody reading, so a
  // recomputed value is offered as a suggestion rather than forced in.
  const bmiSuggestion = bmiFrom(form.weight, form.height);
  const showBmiSuggestion = !locked && bmiSuggestion !== null && bmiSuggestion !== form.bmi;

  // BMR: the InBody measures it directly; Mifflin-St Jeor is only a fallback
  // hint, never auto-filled — see the comment on mifflinStJeor() in
  // lib/diet-assessment.ts (the two figures differ by ~10%, ~150 kcal/day).
  const bmrEstimate = mifflinStJeor(gender ?? null, form.weight, form.height, ageOn(dob ?? null));
  const showBmrHint = !locked && !form.bmr && bmrEstimate !== null;

  const gaps = assessmentGaps(form);

  // ---- medications -------------------------------------------------------
  const updateMedication = (idx: number, patch: Partial<MedicationRow>) => {
    setForm((f) => ({ ...f, medications: f.medications.map((m, i) => (i === idx ? { ...m, ...patch } : m)) }));
    touch();
  };
  const addMedication = () => { setForm((f) => ({ ...f, medications: [...f.medications, blankMedication()] })); touch(); };
  const removeMedication = (idx: number) => { setForm((f) => ({ ...f, medications: f.medications.filter((_, i) => i !== idx) })); touch(); };

  // ---- exercise routine ----------------------------------------------------
  const updateExercise = (idx: number, patch: Partial<ExerciseRow>) => {
    setForm((f) => ({ ...f, exercise: f.exercise.map((x, i) => (i === idx ? { ...x, ...patch } : x)) }));
    touch();
  };
  const addExercise = () => { setForm((f) => ({ ...f, exercise: [...f.exercise, blankExercise()] })); touch(); };
  const removeExercise = (idx: number) => { setForm((f) => ({ ...f, exercise: f.exercise.filter((_, i) => i !== idx) })); touch(); };

  const handleSave = () => {
    setErr(null);
    startSave(async () => {
      const patch: Record<string, unknown> = {};
      for (const k of SAVE_KEYS) {
        const cur = form[k];
        const base = baselineRef.current[k];
        if (JSON.stringify(cur) !== JSON.stringify(base)) patch[k] = cur;
      }
      const r = await saveDietAssessment(id, patch);
      if (r.error) { setErr(r.error); return; }
      baselineRef.current = form;
      setDirty(false);
      setSavedAt(new Date().toISOString());
    });
  };

  const pill = statusPill(status);
  const stressBtn = (value: Exclude<StressLevel, null>, text: string) => {
    const active = form.stress_level === value;
    return (
      <button type="button" key={value} disabled={locked} onClick={() => update("stress_level", value)}
        style={disabledOf(locked, {
          border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          background: active ? "var(--brand-fill)" : "#fff", color: active ? "#fff" : "var(--ink)",
        })}>
        {text}
      </button>
    );
  };

  return (
    <div>
      {/* ---- 1. HEADER ---- */}
      <div style={{ ...box, padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <b style={{ fontSize: 14 }}>{clientName}</b>
          <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 12.5 }}> · Assessment summary v{version}</span>
        </div>
        <span style={{ background: pill.bg, color: pill.fg, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{pill.text}</span>
        <span style={{ flex: 1 }} />
        {locked ? (
          form.issued_on && <span style={{ fontSize: 12, color: "var(--muted)" }}>Issued {form.issued_on}</span>
        ) : (
          <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            Issued
            <input type="date" value={form.issued_on ?? ""} onChange={(e) => update("issued_on", e.target.value || null)} style={{ ...inpControl, width: 150 }} />
          </label>
        )}

        {!readOnly && status === "draft" && (
          <>
            <button type="button" onClick={handleSave} disabled={saving} style={disabledOf(saving, brandBtn)}>{saving ? "Saving…" : "Save"}</button>
            <form action={submitDietAssessment}>
              <input type="hidden" name="id" value={id} />
              <button disabled={gaps.length > 0} style={disabledOf(gaps.length > 0, darkBtn)} title={gaps.length ? "Resolve the gaps below first" : undefined}>Submit for review</button>
            </form>
          </>
        )}

        {!readOnly && status === "in_review" && (
          <>
            <button type="button" onClick={handleSave} disabled={saving} style={disabledOf(saving, brandBtn)}>{saving ? "Saving…" : "Save"}</button>
            {canReview ? (
              <>
                <form action={reviewDietAssessment}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="approve" value="true" />
                  <button style={greenBtn}>Approve &amp; publish</button>
                </form>
                <form action={reviewDietAssessment}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="approve" value="false" />
                  <button style={amberBtn}>Send back to draft</button>
                </form>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Awaiting sign-off</span>
            )}
          </>
        )}

        {status === "published" && (
          <>
            <a href={`/diet-assessment/${id}/print`} target="_blank" rel="noopener" style={{ ...outlineBtn, textDecoration: "none", color: "var(--ink)" }}>Preview PDF →</a>
            {!readOnly && (
              <>
                {/* Copies THIS assessment. createDietAssessment re-drafts from
                    live data and would throw away the corrections already made. */}
                <form action={newDietAssessmentVersionForm}>
                  <input type="hidden" name="id" value={id} />
                  <button style={darkBtn}>New version</button>
                </form>
                {/* One press: stores the file, shares it, sends it. */}
                <DeliverButton kind="assess" id={id} clientName={clientName} ready={pdf.ready} missing={pdf.missing}
                  whatsappReady={Boolean(whatsapp?.ready)} alreadySent={sharedAt} />
              </>
            )}
          </>
        )}
      </div>
      {savedAt && !dirty && <div style={{ fontSize: 11.5, color: "var(--green-text)", margin: "-6px 0 10px" }}>Saved at {new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>}
      {err && <div style={{ fontSize: 12, color: "var(--red-text)", margin: "-6px 0 10px" }}>{err}</div>}

      {/* ---- 2. INITIAL CONSULTATION ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Initial consultation</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><div style={label}>Date of consultation</div>
            <input type="date" disabled={locked} value={form.consulted_on ?? ""} onChange={(e) => update("consulted_on", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Dietitian</div>
            <input disabled={locked} value={form.dietitian ?? ""} onChange={(e) => update("dietitian", e.target.value || null)} style={inpControl} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><div style={label}>Medical history</div>
            <textarea disabled={locked} rows={2} value={form.medical_history ?? ""} onChange={(e) => update("medical_history", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Existing condition</div>
            <textarea disabled={locked} rows={2} value={form.existing_condition ?? ""} onChange={(e) => update("existing_condition", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div><div style={label}>Allergies</div>
            <input disabled={locked} value={form.allergies ?? ""} onChange={(e) => update("allergies", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Family history</div>
            <textarea disabled={locked} rows={2} value={form.family_history ?? ""} onChange={(e) => update("family_history", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Medications</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 28px", gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 600, padding: "0 2px" }}>
          <span>Medication</span><span>Notes</span><span />
        </div>
        {form.medications.map((m, i) => (
          <div key={`med-${i}`} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 28px", gap: 6, marginTop: 6, alignItems: "center" }}>
            <input disabled={locked} value={m.medication} placeholder="Medication" onChange={(e) => updateMedication(i, { medication: e.target.value })} style={inpControl} />
            <input disabled={locked} value={m.notes} placeholder="Notes" onChange={(e) => updateMedication(i, { notes: e.target.value })} style={inpControl} />
            {!locked && <button type="button" onClick={() => removeMedication(i)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete row">✕</button>}
          </div>
        ))}
        {!locked && <button type="button" onClick={addMedication} style={{ ...outlineBtn, marginTop: 8 }}>+ Add medication</button>}
      </div>

      {/* ---- 3. LIFESTYLE ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Lifestyle</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><div style={label}>Occupation</div>
            <input disabled={locked} value={form.occupation ?? ""} onChange={(e) => update("occupation", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Daily activity</div>
            <select disabled={locked} value={form.daily_activity ?? ""} onChange={(e) => update("daily_activity", e.target.value || null)} style={inpControl}>
              <option value="">Select…</option>
              {ACTIVITY_FACTORS.map(([lbl]) => <option key={lbl} value={lbl}>{lbl}</option>)}
            </select></div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Exercise routine</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 28px", gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 600, padding: "0 2px" }}>
          <span>Type</span><span>Frequency</span><span>Duration</span><span />
        </div>
        {form.exercise.map((x, i) => (
          <div key={`ex-${i}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 28px", gap: 6, marginTop: 6, alignItems: "center" }}>
            <input disabled={locked} value={x.type} placeholder="e.g. Walking" onChange={(e) => updateExercise(i, { type: e.target.value })} style={inpControl} />
            <input disabled={locked} value={x.frequency} placeholder="e.g. 5x/week" onChange={(e) => updateExercise(i, { frequency: e.target.value })} style={inpControl} />
            <input disabled={locked} value={x.duration} placeholder="e.g. 30 min" onChange={(e) => updateExercise(i, { duration: e.target.value })} style={inpControl} />
            {!locked && <button type="button" onClick={() => removeExercise(i)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete row">✕</button>}
          </div>
        ))}
        {!locked && <button type="button" onClick={addExercise} style={{ ...outlineBtn, marginTop: 8, marginBottom: 12 }}>+ Add exercise</button>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, marginBottom: 10 }}>
          <div><div style={label}>Sleep hours</div>
            <input disabled={locked} value={form.sleep_hours ?? ""} placeholder="e.g. 7-8" onChange={(e) => update("sleep_hours", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Sleep quality</div>
            <input disabled={locked} value={form.sleep_quality ?? ""} onChange={(e) => update("sleep_quality", e.target.value || null)} style={inpControl} /></div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>Stress level</div>
          <div style={{ display: "flex", gap: 8 }}>
            {stressBtn("low", "Low")}
            {stressBtn("medium", "Medium")}
            {stressBtn("high", "High")}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><div style={label}>Gut health</div>
            <textarea disabled={locked} rows={2} value={form.gut_health ?? ""} onChange={(e) => update("gut_health", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Recent weight change</div>
            <input disabled={locked} value={form.weight_change ?? ""} onChange={(e) => update("weight_change", e.target.value || null)} style={inpControl} /></div>
        </div>
      </div>

      {/* ---- 4. DIETARY PREFERENCE ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Dietary preference</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><div style={label}>Diet type</div>
            <input disabled={locked} value={form.diet_type ?? ""} onChange={(e) => update("diet_type", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Food allergies</div>
            <input disabled={locked} value={form.food_allergies ?? ""} onChange={(e) => update("food_allergies", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Food dislikes</div>
            <textarea disabled={locked} rows={2} value={form.food_dislikes ?? ""} onChange={(e) => update("food_dislikes", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Supplements</div>
            <input disabled={locked} value={form.supplements ?? ""} onChange={(e) => update("supplements", e.target.value || null)} style={inpControl} /></div>
        </div>
      </div>

      {/* ---- 5. CURRENT HEALTH STATUS ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Current health status</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Frozen at issue — this page won&apos;t silently rewrite itself as later measurements come in.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <div><div style={label}>Height (cm)</div>
            <input type="number" step="0.1" disabled={locked} value={form.height ?? ""} onChange={(e) => update("height", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Weight (kg)</div>
            <input type="number" step="0.1" disabled={locked} value={form.weight ?? ""} onChange={(e) => update("weight", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div>
            <div style={label}>BMI</div>
            <input type="number" step="0.1" disabled={locked} value={form.bmi ?? ""} onChange={(e) => update("bmi", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} />
            {showBmiSuggestion && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Suggested {bmiSuggestion} (from height &amp; weight) — <button type="button" onClick={() => update("bmi", bmiSuggestion)} style={smallLink}>Use</button>
              </div>
            )}
          </div>
          <div>
            <div style={label}>BMR (kcal/day)</div>
            <input type="number" disabled={locked} value={form.bmr ?? ""} onChange={(e) => update("bmr", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} />
            {showBmrHint && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                {bmrEstimate} kcal/day estimated — the InBody measures this directly — <button type="button" onClick={() => update("bmr", bmrEstimate)} style={smallLink}>Use estimate</button>
              </div>
            )}
          </div>
          <div><div style={label}>TEE (kcal/day)</div>
            <input type="number" disabled={locked} value={form.tee ?? ""} onChange={(e) => update("tee", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Skeletal muscle mass (kg)</div>
            <input type="number" step="0.1" disabled={locked} value={form.muscle_mass ?? ""} onChange={(e) => update("muscle_mass", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Fat mass (kg)</div>
            <input type="number" step="0.1" disabled={locked} value={form.fat_mass ?? ""} onChange={(e) => update("fat_mass", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Body fat (%)</div>
            <input type="number" step="0.1" disabled={locked} value={form.body_fat ?? ""} onChange={(e) => update("body_fat", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Visceral fat</div>
            <input type="number" step="0.1" disabled={locked} value={form.visceral_fat ?? ""} onChange={(e) => update("visceral_fat", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Waist–hip ratio</div>
            <input type="number" step="0.01" disabled={locked} value={form.waist_hip ?? ""} onChange={(e) => update("waist_hip", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
        </div>
      </div>

      {/* ---- 6. HEALTH & FITNESS GOALS ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Health &amp; fitness goals</div>
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Primary goals</div>
          <textarea disabled={locked} rows={3} value={form.primary_goals ?? ""} onChange={(e) => update("primary_goals", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><div style={label}>Target weight (kg)</div>
            <input type="number" step="0.1" disabled={locked} value={form.target_weight ?? ""} onChange={(e) => update("target_weight", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Timeline (weeks)</div>
            <input type="number" disabled={locked} value={form.timeline_weeks ?? ""} onChange={(e) => update("timeline_weeks", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
        </div>
        <div>
          <div style={label}>Specific objectives</div>
          <textarea disabled={locked} rows={3} value={form.objectives ?? ""} onChange={(e) => update("objectives", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
        </div>
      </div>

      {/* ---- 7. DIETARY INTAKE ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Dietary intake</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><div style={label}>Meal frequency</div>
            <input disabled={locked} value={form.meal_frequency ?? ""} placeholder="e.g. 3 meals + 2 snacks" onChange={(e) => update("meal_frequency", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Meals per day</div>
            <input disabled={locked} value={form.meals_per_day ?? ""} onChange={(e) => update("meals_per_day", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Snacking habits / cravings</div>
            <textarea disabled={locked} rows={2} value={form.snacking ?? ""} onChange={(e) => update("snacking", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Hydration status</div>
            <input disabled={locked} value={form.hydration ?? ""} onChange={(e) => update("hydration", e.target.value || null)} style={inpControl} /></div>
        </div>
      </div>

      {/* ---- 8. NOTES ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Notes</div>
        <textarea disabled={locked} rows={7} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value || null)}
          style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      </div>

      {/* ---- 9. GAPS ---- */}
      {gaps.length > 0 && (
        <div style={{ ...box, padding: 14, marginBottom: 12, background: "var(--red-bg)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--red-text)", marginBottom: 6 }}>Before this can go for review</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--red-text)", fontSize: 12.5 }}>
            {gaps.map((g, i) => <li key={i} style={{ marginBottom: 3 }}>{g}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
