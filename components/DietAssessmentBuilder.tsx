"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  type Assessment, type ExerciseRow, type MedicationRow, type StressLevel,
  ACTIVITY_FACTORS, mifflinStJeor, estimateTee, bmiFrom, fatMassFrom, ageOn, assessmentGaps,
} from "@/lib/diet-assessment";
import { saveDietAssessment, submitDietAssessment, reviewDietAssessment, newDietAssessmentVersion } from "@/lib/actions";
import DeliverButton from "@/components/DeliverButton";
import styles from "@/components/DietAssessmentBuilder.module.css";

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

type SectionTone = "complete" | "attention" | "neutral";

function AssessmentSection({
  step, title, description, summary, tone = "neutral", defaultOpen = false, children,
}: {
  step: number;
  title: string;
  description: string;
  summary: string;
  tone?: SectionTone;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details className={styles.sectionCard} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.sectionSummary}>
        <span className={styles.sectionChevron} aria-hidden="true">›</span>
        <span className={styles.sectionIdentity}>
          <span className={styles.eyebrow}>Step {step}</span>
          <b>{title}</b>
          <small>{description}</small>
        </span>
        <span className={styles.sectionSummaryMeta}>
          <span className={tone === "complete" ? styles.completePill : tone === "attention" ? styles.attentionPill : styles.neutralPill}>{summary}</span>
          <span className={styles.sectionAction}>Open</span>
        </span>
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}

const present = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
};

const filledCount = (values: unknown[]) => values.filter(present).length;

/** The fields this screen edits, plus the issued date which lives on the same row. */
type FormState = Assessment & { issued_on: string | null };

/** Column names `saveDietAssessment` will actually accept — mirrors the ALLOWED
 *  set in lib/actions.ts so the client only ever offers to save real columns. */
const SAVE_KEYS = [
  "consulted_on", "dietitian", "medical_history", "existing_condition", "medications", "allergies", "family_history",
  "occupation", "daily_activity", "exercise", "sleep_hours", "sleep_quality", "stress_level", "gut_health", "weight_change",
  "region", "shift_pattern", "outside_meals",
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
  const consultationFilled = filledCount([
    form.consulted_on, form.dietitian, form.medical_history, form.existing_condition, form.allergies, form.family_history,
  ]);
  const lifestyleFilled = filledCount([
    form.occupation, form.daily_activity, form.sleep_hours, form.sleep_quality, form.stress_level, form.gut_health,
  ]);
  const healthCoreFilled = filledCount([form.height, form.weight, form.bmr]);
  const preferenceFilled = filledCount([form.diet_type, form.food_allergies, form.food_dislikes, form.supplements]);
  const goalCoreFilled = filledCount([form.primary_goals, form.target_weight, form.timeline_weeks]);
  const intakeFilled = filledCount([form.meal_frequency, form.meals_per_day, form.snacking, form.hydration]);

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
    <div className={styles.builder}>
      {/* ---- HEADER ---- */}
      <div style={{ ...box, marginBottom: 12 }} className={styles.assessmentHeader}>
        <div className={styles.headerIdentityRow}>
          <div className={styles.headerIdentity}>
            <div className={styles.eyebrow}>Dietary assessment summary</div>
            <div className={styles.headerTitleRow}>
              <b className={styles.headerTitle}>{clientName}</b>
              <span style={{ background: pill.bg, color: pill.fg }} className={styles.statusPill}>{pill.text}</span>
            </div>
            <div className={styles.headerMeta}>Version {version} · Clinical context for the diet chart</div>
          </div>

          <div className={styles.headerUtilities}>
            {locked ? (
              form.issued_on && <span className={styles.issuedText}>Issued {form.issued_on}</span>
            ) : (
              <label className={styles.issuedField}>
                <span>Issued on</span>
                <input type="date" value={form.issued_on ?? ""} onChange={(e) => update("issued_on", e.target.value || null)} style={{ ...inpControl, width: 150 }} />
              </label>
            )}
            {status === "published" && (
              <a href={`/diet-assessment/${id}/print`} target="_blank" rel="noopener" style={{ ...outlineBtn, textDecoration: "none", color: "var(--ink)" }}>Preview PDF ↗</a>
            )}
          </div>
        </div>

        <div className={styles.actionRow}>
          <div className={styles.readinessSummary}>
            <span className={gaps.length ? styles.readinessDotBlocked : styles.readinessDotReady} />
            <span>
              {gaps.length
                ? <><b>{gaps.length} required check{gaps.length === 1 ? "" : "s"} remaining</b> before {status === "draft" ? "review" : status === "in_review" ? "approval" : "sending"}</>
                : <b>All required checks are complete</b>}
            </span>
          </div>

          <div className={styles.primaryActions}>
            {!readOnly && status === "draft" && (
              <>
                <button type="button" onClick={handleSave} disabled={saving} style={disabledOf(saving, brandBtn)}>{saving ? "Saving…" : "Save"}</button>
                <form action={submitDietAssessment}>
                  <input type="hidden" name="id" value={id} />
                  {/* Submitting posts only the id; the server reads the SAVED rows.
                      Unsaved edits make those two different documents. */}
                  <button disabled={gaps.length > 0 || dirty} style={disabledOf(gaps.length > 0 || dirty, darkBtn)}
                    title={dirty ? "Save your changes first — this submits the saved assessment" : gaps.length ? "Resolve the checks below first" : undefined}>Submit for review</button>
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
                      <button disabled={gaps.length > 0 || dirty} style={disabledOf(gaps.length > 0 || dirty, greenBtn)}
                        title={dirty ? "Save your changes first — this publishes the saved assessment" : gaps.length ? "Resolve the checks below first" : undefined}>Approve &amp; publish</button>
                    </form>
                    <form action={reviewDietAssessment}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="approve" value="false" />
                      <button style={amberBtn}>Send back to draft</button>
                    </form>
                  </>
                ) : (
                  <span className={styles.awaitingText}>Awaiting sign-off</span>
                )}
              </>
            )}

            {status === "published" && !readOnly && (
              <>
                <form action={newDietAssessmentVersionForm}>
                  <input type="hidden" name="id" value={id} />
                  <button style={darkBtn}>New version</button>
                </form>
                <DeliverButton kind="assess" id={id} clientName={clientName} ready={pdf.ready} missing={pdf.missing}
                  whatsappReady={Boolean(whatsapp?.ready)} alreadySent={sharedAt} />
              </>
            )}
          </div>
        </div>
      </div>
      {savedAt && !dirty && <div className={styles.successNotice}>Saved at {new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>}
      {err && <div className={styles.errorNotice}><b>Couldn&apos;t complete that action.</b><span>{err}</span></div>}

      {gaps.length > 0 && (
        <details className={styles.readinessPanel}>
          <summary>
            <span><b>Review readiness</b><small>{gaps.length} required check{gaps.length === 1 ? "" : "s"} remaining</small></span>
            <span className={styles.reviewChecklistAction}>View checklist</span>
          </summary>
          <div className={styles.readinessBody}>
            <div className={styles.readinessInstruction}>
              {status === "draft" ? "Resolve before this assessment can go for review"
                : status === "in_review" ? "Resolve before this assessment can be approved"
                  : "Resolve before this assessment can be sent to the client"}
            </div>
            <ul>{gaps.map((gap, index) => <li key={index}>{gap}</li>)}</ul>
          </div>
        </details>
      )}

      <div className={styles.workflowHeading}>
        <div>
          <div className={styles.eyebrow}>Assessment workflow</div>
          <h3>Complete the clinical story in order</h3>
          <p>Open one section at a time. The summary badges keep the important information visible.</p>
        </div>
      </div>

      {/* ---- 1. INITIAL CONSULTATION ---- */}
      <AssessmentSection step={1} title="Consultation & medical context"
        description="Record what was found, existing risks and current medication."
        summary={`${consultationFilled}/6 key fields`} tone={consultationFilled >= 4 ? "complete" : "neutral"} defaultOpen>
        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Date of consultation</div>
            <input type="date" disabled={locked} value={form.consulted_on ?? ""} onChange={(e) => update("consulted_on", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Dietitian</div>
            <input disabled={locked} value={form.dietitian ?? ""} onChange={(e) => update("dietitian", e.target.value || null)} style={inpControl} /></div>
        </div>
        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Medical history</div>
            <textarea disabled={locked} rows={2} value={form.medical_history ?? ""} onChange={(e) => update("medical_history", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Existing condition</div>
            <textarea disabled={locked} rows={2} value={form.existing_condition ?? ""} onChange={(e) => update("existing_condition", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
        </div>
        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Allergies</div>
            <input disabled={locked} value={form.allergies ?? ""} onChange={(e) => update("allergies", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Family history</div>
            <textarea disabled={locked} rows={2} value={form.family_history ?? ""} onChange={(e) => update("family_history", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
        </div>

        <div className={styles.subsectionHeading}>Medications</div>
        <div className={`${styles.tableHeader} ${styles.medicationGrid}`}>
          <span>Medication</span><span>Notes</span><span />
        </div>
        {form.medications.map((m, i) => (
          <div key={`med-${i}`} className={`${styles.tableRow} ${styles.medicationGrid}`}>
            <input disabled={locked} value={m.medication} placeholder="Medication" onChange={(e) => updateMedication(i, { medication: e.target.value })} style={inpControl} />
            <input disabled={locked} value={m.notes} placeholder="Notes" onChange={(e) => updateMedication(i, { notes: e.target.value })} style={inpControl} />
            {!locked && <button type="button" onClick={() => removeMedication(i)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete row">✕</button>}
          </div>
        ))}
        {!locked && <button type="button" onClick={addMedication} style={{ ...outlineBtn, marginTop: 8 }}>+ Add medication</button>}
      </AssessmentSection>

      {/* ---- 2. LIFESTYLE ---- */}
      <AssessmentSection step={2} title="Lifestyle & activity"
        description="Set the activity level first so the energy calculation has the right context."
        summary={form.daily_activity ? `${lifestyleFilled}/6 captured` : "Activity required"}
        tone={form.daily_activity ? "complete" : "attention"}>
        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Occupation</div>
            <input disabled={locked} value={form.occupation ?? ""} onChange={(e) => update("occupation", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Daily activity</div>
            <select disabled={locked} value={form.daily_activity ?? ""} onChange={(e) => update("daily_activity", e.target.value || null)} style={inpControl}>
              <option value="">Select…</option>
              {ACTIVITY_FACTORS.map(([lbl]) => <option key={lbl} value={lbl}>{lbl}</option>)}
            </select></div>
        </div>

        <div className={styles.subsectionHeading}>Exercise routine</div>
        <div className={`${styles.tableHeader} ${styles.exerciseGrid}`}>
          <span>Type</span><span>Frequency</span><span>Duration</span><span />
        </div>
        {form.exercise.map((x, i) => (
          <div key={`ex-${i}`} className={`${styles.tableRow} ${styles.exerciseGrid}`}>
            <input disabled={locked} value={x.type} placeholder="e.g. Walking" onChange={(e) => updateExercise(i, { type: e.target.value })} style={inpControl} />
            <input disabled={locked} value={x.frequency} placeholder="e.g. 5x/week" onChange={(e) => updateExercise(i, { frequency: e.target.value })} style={inpControl} />
            <input disabled={locked} value={x.duration} placeholder="e.g. 30 min" onChange={(e) => updateExercise(i, { duration: e.target.value })} style={inpControl} />
            {!locked && <button type="button" onClick={() => removeExercise(i)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete row">✕</button>}
          </div>
        ))}
        {!locked && <button type="button" onClick={addExercise} style={{ ...outlineBtn, marginTop: 8, marginBottom: 12 }}>+ Add exercise</button>}

        <div className={styles.fieldGridTwo}>
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

        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Gut health</div>
            <textarea disabled={locked} rows={2} value={form.gut_health ?? ""} onChange={(e) => update("gut_health", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Recent weight change</div>
            <input disabled={locked} value={form.weight_change ?? ""} onChange={(e) => update("weight_change", e.target.value || null)} style={inpControl} /></div>
        </div>

        {/* The three things section 1 designs a chart from that had nowhere to
            live. Each is blank by default on purpose, and the placeholder says
            what blank means — an empty Region box is the Kerala default being
            taken, not a question nobody asked. */}
        <div className={styles.fieldGridThree}>
          <div><div style={label}>Region</div>
            <input disabled={locked} value={form.region ?? ""} placeholder="Kerala unless stated"
              onChange={(e) => update("region", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Shift pattern</div>
            <input disabled={locked} value={form.shift_pattern ?? ""} placeholder="Ordinary daytime unless stated"
              onChange={(e) => update("shift_pattern", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Eats out / English meals</div>
            <input disabled={locked} value={form.outside_meals ?? ""} placeholder="How often, and what"
              onChange={(e) => update("outside_meals", e.target.value || null)} style={inpControl} /></div>
        </div>
      </AssessmentSection>

      {/* ---- 3. DIETARY PREFERENCE ---- */}
      <AssessmentSection step={3} title="Dietary preferences & restrictions"
        description="Capture what the client can, cannot and does not want to eat."
        summary={preferenceFilled ? `${preferenceFilled}/4 captured` : "Add dietary context"}
        tone={preferenceFilled >= 2 ? "complete" : "neutral"}>
        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Diet type</div>
            <input disabled={locked} value={form.diet_type ?? ""} onChange={(e) => update("diet_type", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Food allergies</div>
            <input disabled={locked} value={form.food_allergies ?? ""} onChange={(e) => update("food_allergies", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Food dislikes</div>
            <textarea disabled={locked} rows={2} value={form.food_dislikes ?? ""} onChange={(e) => update("food_dislikes", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Supplements</div>
            <input disabled={locked} value={form.supplements ?? ""} onChange={(e) => update("supplements", e.target.value || null)} style={inpControl} /></div>
        </div>
      </AssessmentSection>

      {/* ---- 4. CURRENT HEALTH STATUS ---- */}
      <AssessmentSection step={4} title="Measurements & energy"
        description="Confirm measured values and the calculated energy baseline. Frozen when issued."
        summary={healthCoreFilled === 3 ? `${form.weight ?? "—"} kg · ${form.tee ?? "—"} kcal TEE` : `${3 - healthCoreFilled} core metric${3 - healthCoreFilled === 1 ? "" : "s"} required`}
        tone={healthCoreFilled === 3 ? "complete" : "attention"}>
        <div className={styles.measurementNotice}>These values are frozen at issue and will not silently change when later measurements are added.</div>
        <div className={styles.measurementGrid}>
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
      </AssessmentSection>

      {/* ---- 5. HEALTH & FITNESS GOALS ---- */}
      <AssessmentSection step={5} title="Health & fitness goals"
        description="Translate the assessment into a clear outcome, target and timeframe."
        summary={form.primary_goals ? `${goalCoreFilled}/3 planning fields` : "Primary goal required"}
        tone={form.primary_goals ? "complete" : "attention"}>
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Primary goals</div>
          <textarea disabled={locked} rows={3} value={form.primary_goals ?? ""} onChange={(e) => update("primary_goals", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
        </div>
        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Target weight (kg)</div>
            <input type="number" step="0.1" disabled={locked} value={form.target_weight ?? ""} onChange={(e) => update("target_weight", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
          <div><div style={label}>Timeline (weeks)</div>
            <input type="number" disabled={locked} value={form.timeline_weeks ?? ""} onChange={(e) => update("timeline_weeks", e.target.value === "" ? null : Number(e.target.value))} style={inpControl} /></div>
        </div>
        <div>
          <div style={label}>Specific objectives</div>
          <textarea disabled={locked} rows={3} value={form.objectives ?? ""} onChange={(e) => update("objectives", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
        </div>
      </AssessmentSection>

      {/* ---- 6. DIETARY INTAKE ---- */}
      <AssessmentSection step={6} title="Dietary intake pattern"
        description="Summarise meal timing, frequency, cravings and hydration."
        summary={intakeFilled ? `${intakeFilled}/4 captured` : "Add intake pattern"}
        tone={intakeFilled >= 3 ? "complete" : "neutral"}>
        <div className={styles.fieldGridTwo}>
          <div><div style={label}>Meal frequency</div>
            <input disabled={locked} value={form.meal_frequency ?? ""} placeholder="e.g. 3 meals + 2 snacks" onChange={(e) => update("meal_frequency", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Meals per day</div>
            <input disabled={locked} value={form.meals_per_day ?? ""} onChange={(e) => update("meals_per_day", e.target.value || null)} style={inpControl} /></div>
          <div><div style={label}>Snacking habits / cravings</div>
            <textarea disabled={locked} rows={2} value={form.snacking ?? ""} onChange={(e) => update("snacking", e.target.value || null)} style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} /></div>
          <div><div style={label}>Hydration status</div>
            <input disabled={locked} value={form.hydration ?? ""} onChange={(e) => update("hydration", e.target.value || null)} style={inpControl} /></div>
        </div>
      </AssessmentSection>

      {/* ---- 7. NOTES ---- */}
      <AssessmentSection step={7} title="Clinical notes"
        description="Keep only additional context that does not belong in a structured field."
        summary={form.notes ? "Notes added" : "Optional"} tone="neutral">
        <textarea disabled={locked} rows={7} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value || null)}
          style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      </AssessmentSection>

    </div>
  );
}
