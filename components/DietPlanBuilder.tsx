"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  type PlanMeal, type PlanOption, type PlanTargets, type DishOption, type TargetMacroKey,
  planTotals, targetCheck, planProblems, resequence, optionNutrients,
  MACROS, MACRO_LABELS, MACRO_TARGETS, optionMicronutrients, micronutrientLine, targetStepProblem,
} from "@/lib/diet-plan";
import { rulesFor, optionInteractions } from "@/lib/food-drug";
import { labFindings, type LabResult } from "@/lib/lab-results";
import { contextNotes, type ClientContext } from "@/lib/client-context";
import { saveDietPlan, submitDietPlan, reviewDietPlan, newDietPlanVersion, suggestDietPlanCompletion } from "@/lib/actions";
import { completeDietPlanDraft } from "@/lib/diet-plan-assistant";
import type { GeneratedPlan } from "@/lib/diet-plan-ai";
import DeliverButton from "@/components/DeliverButton";
import styles from "./DietPlanBuilder.module.css";

export type PlanMeta = { allergies: string | null; notes: string | null; issued_on: string | null };

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

const disabledOf = (disabled: boolean, s: React.CSSProperties): React.CSSProperties =>
  disabled ? { ...s, opacity: 0.55, cursor: "default" } : s;

const newDietPlanVersionForm = async (formData: FormData) => {
  await newDietPlanVersion(formData);
};

/** A blank option row — a new "+ Add option" click. Free text until linked. */
const blankOption = (seq: number): PlanOption => ({
  seq, food_items: "", qty: "", kcal: null, carb_g: null, protein_g: null,
  fat_g: null, fibre_g: null, micronutrients: "", components: [],
});

/** A blank meal slot — a new "+ Add meal slot" click. */
const blankMeal = (seq: number): PlanMeal => ({ seq, name: "", time_from: null, time_to: null, note: null, conditional: false, options: [] });

const mealKey = (meal: PlanMeal, index: number) => meal.id ?? `meal-${index}`;
const OPTION_NUTRIENT_LABELS: Record<(typeof MACROS)[number], string> = {
  kcal: "Calories", carb_g: "Carbs (g)", protein_g: "Protein (g)",
  fat_g: "Fat (g)", fibre_g: "Fibre (g)",
};

const statusPill = (status: string) => {
  if (status === "published") return { bg: "var(--green-bg)", fg: "var(--green-text)", text: "Published" };
  if (status === "in_review") return { bg: "var(--blue-bg)", fg: "var(--blue-text)", text: "In review" };
  return { bg: "var(--amber-bg)", fg: "var(--amber-text)", text: "Draft" };
};

/** The kcal range this one slot contributes, across its own options. */
function slotRangeText(m: PlanMeal): string {
  const opts = m.options.filter((o) => o.food_items.trim());
  if (!opts.length) return "No options yet.";
  const kcals = opts.map((o) => o.kcal ?? 0);
  const lo = Math.min(...kcals), hi = Math.max(...kcals);
  return (lo === hi ? `${lo} kcal` : `${lo}–${hi} kcal`) + ` across ${opts.length} option${opts.length === 1 ? "" : "s"}`;
}

/**
 * The dietitian's plan builder — targets, meal slots and their numbered
 * options, live totals against the target, and the draft → review → publish
 * lifecycle. A published plan renders fully read-only; editing it means
 * starting a new version, because a published plan is what the client is
 * already eating from.
 */
export default function DietPlanBuilder({
  planId, clientName, status, version, canReview, initial, dishes, medications = [],
  labs = [], context = null, previousTargetKcal = null, readOnly = false, pdf, whatsapp }: {
  planId: string;
  /**
   * The recipe library, priced per serving. An option linked to one of these
   * takes its calories and protein from the recipe and stops accepting typed
   * figures — change the dish and every chart still open follows.
   */
  dishes: DishOption[];
  /** Whether server-side PDF rendering is configured — see lib/pdf.ts. */
  pdf: { ready: boolean; missing: string[] };
  whatsapp?: { ready: boolean; missing: string[] };
  clientName: string;
  /**
   * What this client is currently taking, as somebody typed it. Free text on
   * purpose — "Thyronorm 50mcg OD" is what a prescription actually says.
   */
  medications?: string[];
  /** This client's lab values, for section 4's deficiency panel. */
  labs?: LabResult[];
  /** Region, shift pattern and eating-out habit, from the latest assessment. */
  context?: ClientContext | null;
  /** The calorie target on the version before this one, for section 2's step rule. */
  previousTargetKcal?: number | null;
  status: string;
  version: number;
  /** Can approve/send-back a plan awaiting sign-off (Super Admin / Administrator). */
  canReview: boolean;
  initial: { targets: PlanTargets; meta: PlanMeta; meals: PlanMeal[]; sharedAt: string | null };
  /** Workspace-level view-only mode (e.g. an admin previewing another discipline). */
  readOnly?: boolean;
}) {
  const [targets, setTargets] = useState<PlanTargets>(initial.targets);
  const [meta, setMeta] = useState<PlanMeta>(initial.meta);
  const [meals, setMeals] = useState<PlanMeal[]>(initial.meals);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [completing, startCompletion] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [assistantProposal, setAssistantProposal] = useState<GeneratedPlan | null>(null);
  const [openMealKeys, setOpenMealKeys] = useState<Set<string>>(
    () => new Set(initial.meals[0] ? [mealKey(initial.meals[0], 0)] : []),
  );

  // A published plan is a fixed document; a workspace-level read-only view
  // (e.g. an admin previewing a discipline they don't hold) is the same.
  const locked = readOnly || status === "published";

  // Warn on unload rather than autosave — mirrors ConsoleView's pattern.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault(); e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const touch = () => setDirty(true);

  const setTargetBound = (key: TargetMacroKey, bound: "min" | "max", value: string) => {
    setTargets((t) => ({
      ...t,
      [key]: { ...t[key], [bound]: value === "" ? null : Number(value) },
    }));
    touch();
  };

  const updateMeal = (idx: number, patch: Partial<PlanMeal>) => {
    setMeals((ms) => ms.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
    touch();
  };
  const moveMeal = (idx: number, dir: -1 | 1) => {
    setMeals((ms) => {
      const j = idx + dir;
      if (j < 0 || j >= ms.length) return ms;
      const copy = ms.slice();
      const tmp = copy[idx]; copy[idx] = copy[j]; copy[j] = tmp;
      return resequence(copy);
    });
    touch();
  };
  const removeMeal = (idx: number) => {
    setMeals((ms) => resequence(ms.filter((_, i) => i !== idx)));
    touch();
  };
  const addMeal = () => {
    setMeals((ms) => {
      const next = blankMeal(ms.length);
      setOpenMealKeys((keys) => new Set(keys).add(mealKey(next, ms.length)));
      return [...ms, next];
    });
    touch();
  };

  const updateOption = (mealIdx: number, optIdx: number, patch: Partial<PlanOption>) => {
    setMeals((ms) => ms.map((m, i) => (i === mealIdx ? { ...m, options: m.options.map((o, j) => (j === optIdx ? { ...o, ...patch } : o)) } : m)));
    touch();
  };
  const addOption = (mealIdx: number) => {
    setMeals((ms) => ms.map((m, i) => (i === mealIdx ? { ...m, options: [...m.options, blankOption(m.options.length)] } : m)));
    touch();
  };
  const removeOption = (mealIdx: number, optIdx: number) => {
    setMeals((ms) => ms.map((m, i) => (i === mealIdx ? { ...m, options: resequence(m.options.filter((_, j) => j !== optIdx)) } : m)));
    touch();
  };

  const dishMap = useMemo(() => new Map<string, DishOption>(dishes.map((d) => [d.id, d] as const)), [dishes]);

  // Only what the dietitian has cleared is on offer. An imported library
  // arrives unapproved, so this is what keeps a thousand recipes nobody here
  // has read out of the pickers while she works through them.
  const selectable = useMemo(() => dishes.filter((d) => d.approved), [dishes]);

  /**
   * Change what an option is built from, and re-total it.
   *
   * The numbers are worked out here as well as on the server. The server's
   * copy is the one that counts — it is what stops a stale tab writing its own
   * figures — but the day's totals, the ±40 kcal spread check and the problem
   * list all read the rows on screen, and they would all be wrong until the
   * next save if this only greyed the boxes out.
   *
   * Nothing is written into the Food items or Qty boxes. Those are the words
   * the client reads, the portions vary from client to client, and an option
   * made of four recipes has no single name to borrow anyway.
   */
  const setComponents = (mealIdx: number, optIdx: number, components: PlanOption["components"]) => {
    const priced = optionNutrients(components, dishMap);
    updateOption(mealIdx, optIdx, {
      components: resequence(components),
      // An option with nothing linked goes back to being free text, and keeps
      // whatever figures were last worked out so she has something to adjust
      // rather than an empty row.
      ...(components.length
        ? Object.fromEntries(MACROS.map((k) => [k, priced?.[k] ?? null]))
        : {}),
    });
  };

  const addComponent = (mealIdx: number, optIdx: number, o: PlanOption) => {
    const first = selectable[0];
    if (!first) return;
    // Building from recipes replaces whatever she typed, and removing the
    // component again cannot bring it back. On the FIRST one, where there are
    // figures to lose, that is worth a question — a misplaced click on a row
    // she has already costed by hand should not quietly undo the work.
    if (!o.components.length && MACROS.some((k) => o[k] != null)
      && !window.confirm("Building this option from recipes will replace the figures you typed. Continue?")) {
      return;
    }
    setComponents(mealIdx, optIdx, [...o.components, { seq: o.components.length, dish_id: first.id, servings: 1 }]);
  };

  const updateComponent = (mealIdx: number, optIdx: number, at: number, patch: Partial<PlanOption["components"][number]>, o: PlanOption) => {
    setComponents(mealIdx, optIdx, o.components.map((c, k) => (k === at ? { ...c, ...patch } : c)));
  };

  const removeComponent = (mealIdx: number, optIdx: number, at: number, o: PlanOption) => {
    setComponents(mealIdx, optIdx, o.components.filter((_, k) => k !== at));
  };

  const totals = planTotals(meals);
  const check = targetCheck(totals, targets.kcal);
  const problems = planProblems(meals, targets, dishes);
  const targetProblems = problems.filter((problem) => problem.startsWith("No daily"));
  const problemsForMeal = (meal: PlanMeal) => {
    const name = meal.name.trim() || "Untitled slot";
    return problems.filter((problem) => problem.startsWith(`${name} `) || problem.startsWith(`${name} ·`));
  };
  const toggleMeal = (key: string) => {
    setOpenMealKeys((keys) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Section 2's step rule. A warning rather than a refusal: a target set from
  // an estimated BMR and then corrected by a real InBody reading can move 400
  // kcal in one step and be more right afterwards, not less.
  const stepWarning = targetStepProblem(previousTargetKcal, targets.kcal);

  // Section 4. Only what is out of range, latest result per marker.
  const findings = useMemo(() => labFindings(labs), [labs]);

  // A proposal is always merged against what is on screen NOW. If the
  // dietitian changes a field while the assistant is thinking, existing work
  // still wins and the preview is recalculated rather than restoring an old
  // snapshot over her edits.
  const completionPreview = useMemo(
    () => assistantProposal ? completeDietPlanDraft(meals, assistantProposal, dishes) : null,
    [assistantProposal, meals, dishes],
  );
  const completionProblems = useMemo(
    () => completionPreview ? planProblems(completionPreview.meals, targets, dishes) : [],
    [completionPreview, targets, dishes],
  );

  // Sections 9, 6 and 10 — reminders, never refusals.
  const notes = useMemo(
    () => (context ? contextNotes(context, meals) : []),
    [context, meals],
  );

  /**
   * The chart read against what the client is taking.
   *
   * Separate from `problems` on purpose. Those are things wrong with the chart
   * and they stop it being published; this is a clinical judgement the
   * dietitian makes, and most of these are solved by timing rather than by
   * changing the food. A chart that cannot go out until somebody overrides a
   * warning teaches everybody to override warnings.
   */
  const drugWatch = useMemo(() => {
    const rules = rulesFor(medications);
    if (!rules.length) return null;
    const found: { where: string; text: string }[] = [];
    let unchecked = 0;
    for (const m of meals) {
      m.options.forEach((o, j) => {
        if (!o.food_items.trim()) return;
        const where = `${m.name || "Untitled slot"} · option ${j + 1}`;
        const r = optionInteractions(where, o.food_items,
          optionMicronutrients(o.components, dishMap), rules);
        found.push(...r.found);
        if (r.unchecked) unchecked++;
      });
    }
    return { rules, found, unchecked };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, medications, dishes]);

  const handleSave = () => {
    setErr(null);
    startSave(async () => {
      const mealsIn = meals.map((m, i) => ({
        seq: i, name: m.name, time_from: m.time_from, time_to: m.time_to, note: m.note, conditional: m.conditional,
        options: m.options.map((o, j) => ({
          seq: j, food_items: o.food_items, qty: o.qty,
          kcal: o.kcal, carb_g: o.carb_g, protein_g: o.protein_g, fat_g: o.fat_g, fibre_g: o.fibre_g,
          micronutrients: o.micronutrients,
          components: o.components.map((c, k) => ({ seq: k, dish_id: c.dish_id, servings: c.servings })),
        })),
      }));
      const r = await saveDietPlan(planId, targets, meta, mealsIn);
      if (r.error) { setErr(r.error); return; }
      setDirty(false);
      setSavedAt(new Date().toISOString());
    });
  };

  const requestCompletion = () => {
    setErr(null);
    setAssistantProposal(null);
    if (dirty) {
      setErr("Save the current edits first. The assistant reads the saved V2 draft so it cannot work from a different chart than the one on screen.");
      return;
    }
    startCompletion(async () => {
      try {
        const result = await suggestDietPlanCompletion(planId);
        if (result.error || !result.proposal) {
          setErr(result.error ?? "The assistant did not return a proposal.");
          return;
        }
        setAssistantProposal(result.proposal);
      } catch {
        setErr("The assistant could not prepare suggestions. Nothing was changed — try again when the connection is stable.");
      }
    });
  };

  const applyCompletion = () => {
    if (!completionPreview) return;
    setMeals(completionPreview.meals);
    setAssistantProposal(null);
    setSavedAt(null);
    setDirty(true);
  };

  const pill = statusPill(status);

  return (
    <div className={styles.builder}>
      {/* ---- HEADER ---- */}
      <div style={{ ...box, marginBottom: 12 }} className={styles.chartHeader}>
        <div className={styles.headerIdentityRow}>
          <div className={styles.headerIdentity}>
            <div className={styles.eyebrow}>Diet chart</div>
            <div className={styles.headerTitleRow}>
              <b className={styles.headerTitle}>{clientName}</b>
              <span style={{ background: pill.bg, color: pill.fg }} className={styles.statusPill}>{pill.text}</span>
            </div>
            <div className={styles.headerMeta}>Version {version}</div>
          </div>

          <div className={styles.headerUtilities}>
            {locked ? (
              meta.issued_on && <span className={styles.issuedText}>Issued {meta.issued_on}</span>
            ) : (
              <label className={styles.issuedField}>
                <span>Issued on</span>
                <input type="date" value={meta.issued_on ?? ""} onChange={(e) => { setMeta((m) => ({ ...m, issued_on: e.target.value || null })); touch(); }} style={{ ...inpControl, width: 150 }} />
              </label>
            )}
            <a href={`/diet-plan/${planId}/print`} target="_blank" rel="noopener" style={{ ...outlineBtn, textDecoration: "none", color: "var(--ink)" }}>Preview PDF ↗</a>
          </div>
        </div>

        <div className={styles.actionRow}>
          <div className={styles.readinessSummary}>
            <span className={problems.length ? styles.readinessDotBlocked : styles.readinessDotReady} />
            <span>
              {problems.length
                ? <><b>{problems.length} check{problems.length === 1 ? "" : "s"} remaining</b> before {status === "draft" ? "review" : status === "in_review" ? "approval" : "sending"}</>
                : <b>All required checks are complete</b>}
            </span>
          </div>

          <div className={styles.primaryActions}>
        {/* One press: makes the stored file, puts it in the portal, sends it.
            Preview above is just a look — it leaves nothing behind.

            Two gates, and both matter. Unresolved checks mean the chart does not
            add up. Anything short of published means nobody has signed it off —
            and WhatsApp has no unsend, so an unapproved draft reaching a patient
            cannot be walked back. The assessment builder has always gated on
            published; this one did not, which is how a draft could be sent. */}
        {status !== "published" ? (
          null
        ) : problems.length === 0 ? (
          <DeliverButton kind="plan" id={planId} clientName={clientName} ready={pdf.ready} missing={pdf.missing}
            whatsappReady={Boolean(whatsapp?.ready)} alreadySent={initial.sharedAt} />
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--red-text)", fontWeight: 600 }}>
            {problems.length} check{problems.length === 1 ? "" : "s"} to resolve before this can be sent
          </span>
        )}

        {!readOnly && status === "draft" && (
          <>
            <button type="button" onClick={requestCompletion} disabled={saving || completing || dirty}
              style={disabledOf(saving || completing || dirty, outlineBtn)}
              title={dirty ? "Save your changes first — the assistant reads the saved draft" : "Propose missing recipe-backed choices without saving or creating a new version"}>
              {completing ? "Preparing suggestions…" : "✦ Auto-complete this draft"}
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={disabledOf(saving, brandBtn)}>{saving ? "Saving…" : "Save"}</button>
            {/* Submitting posts only the plan id — the server then re-reads the
                SAVED rows. With unsaved edits on screen those are two different
                charts, and the mismatch is silent: the server finds the old row
                still incomplete and simply does nothing, with nothing to show
                for the press. So the button waits for Save. */}
            <form action={submitDietPlan}>
              <input type="hidden" name="id" value={planId} />
              <button disabled={problems.length > 0 || dirty} style={disabledOf(problems.length > 0 || dirty, darkBtn)}
                title={dirty ? "Save your changes first — this submits the saved chart" : problems.length ? "Resolve the problems below first" : undefined}>Submit for review</button>
            </form>
          </>
        )}

        {!readOnly && status === "in_review" && (
          <>
            <button type="button" onClick={handleSave} disabled={saving} style={disabledOf(saving, brandBtn)}>{saving ? "Saving…" : "Save"}</button>
            {canReview ? (
              <>
                <form action={reviewDietPlan}>
                  <input type="hidden" name="id" value={planId} />
                  <input type="hidden" name="approve" value="true" />
                  {/* Approving is the signature. Sending back is always open —
                      unresolved checks are exactly what you send a chart back for.
                      Unsaved edits block approval for a sharper reason than they
                      block submission: what gets frozen as published would be the
                      saved version, not the one the approver is looking at. */}
                  <button disabled={problems.length > 0 || dirty} style={disabledOf(problems.length > 0 || dirty, greenBtn)}
                    title={dirty ? "Save your changes first — this publishes the saved chart" : problems.length ? "Resolve the checks below first" : undefined}>Approve &amp; publish</button>
                </form>
                <form action={reviewDietPlan}>
                  <input type="hidden" name="id" value={planId} />
                  <input type="hidden" name="approve" value="false" />
                  <button style={amberBtn}>Send back to draft</button>
                </form>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Awaiting sign-off</span>
            )}
          </>
        )}

        {!readOnly && status === "published" && (
          <>
            <form action={newDietPlanVersionForm}>
              <input type="hidden" name="id" value={planId} />
              <button style={darkBtn}>New version</button>
            </form>
          </>
        )}
          </div>
        </div>
      </div>
      {savedAt && !dirty && <div className={styles.successNotice}>Saved at {new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>}
      {err && <div className={styles.errorNotice}><b>Couldn&apos;t complete that action.</b><span>{err}</span></div>}

      {completionPreview && (
        <div style={{ ...box, padding: 16, marginBottom: 12, borderColor: "var(--brand-fill)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Review the proposed completion</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            Nothing has changed yet. Existing entries are preserved; only calculated, recipe-backed blanks and missing choices are proposed.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
              {completionPreview.added.length} option{completionPreview.added.length === 1 ? "" : "s"} proposed
            </span>
            <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
              {completionPreview.filledMicronutrients.length} micronutrient line{completionPreview.filledMicronutrients.length === 1 ? "" : "s"} calculated
            </span>
            <span style={{ background: completionProblems.length ? "var(--amber-bg)" : "var(--green-bg)", color: completionProblems.length ? "var(--amber-text)" : "var(--green-text)", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>
              {completionProblems.length} check{completionProblems.length === 1 ? "" : "s"} would remain
            </span>
          </div>

          {completionPreview.added.length > 0 && (
            <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 12.5 }}>
              {completionPreview.added.map((item, index) => (
                <li key={`${item.meal}-${item.option}-${index}`} style={{ marginBottom: 3 }}>
                  <b>{item.meal}:</b> {item.option}
                </li>
              ))}
            </ul>
          )}

          <div style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "9px 11px", fontSize: 12, marginBottom: 10 }}>
            Daily carbohydrate, protein, fat, fibre and water targets remain for the dietitian to settle. The assistant does not turn the food it selected into a circular clinical target.
          </div>

          {completionPreview.skipped.length > 0 && (
            <details style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                {completionPreview.skipped.length} item{completionPreview.skipped.length === 1 ? "" : "s"} still need manual review
              </summary>
              <ul style={{ margin: "7px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--muted)" }}>
                {completionPreview.skipped.map((item, index) => <li key={index} style={{ marginBottom: 3 }}>{item}</li>)}
              </ul>
            </details>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={applyCompletion}
              disabled={completionPreview.added.length === 0 && completionPreview.filledMicronutrients.length === 0}
              style={disabledOf(completionPreview.added.length === 0 && completionPreview.filledMicronutrients.length === 0, brandBtn)}>
              Apply to the unsaved draft
            </button>
            <button type="button" onClick={() => setAssistantProposal(null)} style={outlineBtn}>Discard</button>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>After applying, review every row and press Save yourself.</span>
          </div>
        </div>
      )}

      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.eyebrow}>Step 1</div>
          <h3>Set the day&apos;s targets</h3>
        </div>
        {targetProblems.length > 0 && <span className={styles.issuePill}>{targetProblems.length} missing</span>}
      </div>

      <div className={styles.overviewGrid}>
        {/* ---- TARGETS ---- */}
        <div style={{ ...box, padding: 16 }}>
          <div className={styles.cardHeading}>Daily targets</div>
          <div className={styles.targetsGrid}>
            <div><div style={label}>Calories (kcal/day)</div>
              <input type="number" disabled={locked} value={targets.kcal ?? ""} onChange={(e) => { setTargets((t) => ({ ...t, kcal: e.target.value === "" ? null : Number(e.target.value) })); touch(); }} style={inpControl} /></div>
            {MACRO_TARGETS.map(([key, , targetLabel]) => (
              <div key={key}>
                <div style={label}>{targetLabel[0].toUpperCase() + targetLabel.slice(1)} (g/day)</div>
                <div className={styles.rangeFields}>
                  <input type="number" min="0" step="0.1" disabled={locked} aria-label={`${targetLabel} minimum`}
                    value={targets[key].min ?? ""} placeholder="Min"
                    onChange={(e) => setTargetBound(key, "min", e.target.value)} style={inpControl} />
                  <span>to</span>
                  <input type="number" min="0" step="0.1" disabled={locked} aria-label={`${targetLabel} maximum`}
                    value={targets[key].max ?? ""} placeholder="Max"
                    onChange={(e) => setTargetBound(key, "max", e.target.value)} style={inpControl} />
                </div>
              </div>
            ))}
            <div><div style={label}>Water</div>
              <input disabled={locked} value={targets.water ?? ""} placeholder="e.g. 2.5–3 L/day" onChange={(e) => { setTargets((t) => ({ ...t, water: e.target.value || null })); touch(); }} style={inpControl} /></div>
            <div className={styles.allergyField}><div style={label}>Food allergies</div>
              <input disabled={locked} value={meta.allergies ?? ""} placeholder="e.g. Peanuts, shellfish" onChange={(e) => { setMeta((m) => ({ ...m, allergies: e.target.value || null })); touch(); }} style={inpControl} /></div>
          </div>
        </div>

        {/* ---- LIVE TOTALS ---- */}
        <div style={{
          ...box, padding: 16,
          background: check.tone === "ok" ? "var(--green-bg)" : check.tone === "warn" ? "var(--amber-bg)" : "var(--card)",
        }}>
          <div className={styles.cardHeading}>Current day totals</div>
          <div className={styles.kcalTotal} style={{ color: check.tone === "ok" ? "var(--green-text)" : check.tone === "warn" ? "var(--amber-text)" : "var(--ink)" }}>
            {totals.minKcal}–{totals.maxKcal} <small>kcal</small>
          </div>
          <div className={styles.macroTotals}>
            {MACRO_LABELS.map(([k, macroLabel]) => (
              <div key={k}>
                <span>{macroLabel}</span>
                <b>{totals.macros[k].min}–{totals.macros[k].max} g</b>
              </div>
            ))}
          </div>
          {check.text && <div className={styles.totalMessage} style={{ color: check.tone === "ok" ? "var(--green-text)" : "var(--amber-text)" }}>{check.text}</div>}
          {stepWarning && <div className={styles.totalMessage} style={{ color: "var(--amber-text)" }}>{stepWarning}</div>}
        </div>
      </div>

      {/* ---- PROBLEMS ---- */}
      {problems.length > 0 && (
        <details className={styles.readinessPanel}>
          <summary>
            <span><b>Review readiness</b><small>{problems.length} required check{problems.length === 1 ? "" : "s"} remaining</small></span>
            <span className={styles.reviewChecklistAction}>View checklist</span>
          </summary>
          <div className={styles.readinessBody}>
            <div className={styles.readinessInstruction}>
              {status === "draft" ? "Complete these before sending the chart for review."
                : status === "in_review" ? "Complete these before approving the chart."
                  : "Complete these before sending the chart to the client."}
            </div>
            <ul>
              {problems.map((problem, index) => <li key={index}>{problem}</li>)}
            </ul>
          </div>
        </details>
      )}

      {/* ---- MEAL SLOTS ---- */}
      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.eyebrow}>Step 2</div>
          <h3>Build the meal schedule</h3>
          <p>Open one slot to work on it. The others stay summarized.</p>
        </div>
        <div className={styles.sectionActions}>
          <button type="button" onClick={() => setOpenMealKeys(new Set(meals.map(mealKey)))} style={outlineBtn}>Expand all</button>
          <button type="button" onClick={() => setOpenMealKeys(new Set())} style={outlineBtn}>Collapse all</button>
        </div>
      </div>

      {meals.map((m, i) => {
        const key = mealKey(m, i);
        const open = openMealKeys.has(key);
        const mealIssues = problemsForMeal(m);
        const activeOptions = m.options.filter((option) => option.food_items.trim()).length;
        return (
        <div key={key} style={box} className={styles.mealCard}>
          <div className={styles.mealSummary}>
            <button type="button" onClick={() => toggleMeal(key)} className={styles.mealToggle} aria-expanded={open}>
              <span className={styles.chevron}>{open ? "▾" : "›"}</span>
              <span>
                <b>{m.name.trim() || `Untitled meal ${i + 1}`}</b>
                <small>{m.time_from || m.time_to ? [m.time_from, m.time_to].filter(Boolean).join("–") : "Time not set"}{m.conditional ? " · Conditional" : ""}</small>
              </span>
            </button>
            <div className={styles.mealBadges}>
              <span className={activeOptions === 4 ? styles.completePill : styles.incompletePill}>{activeOptions}/4 options</span>
              <span className={styles.rangePill}>{slotRangeText(m)}</span>
              {mealIssues.length > 0 && <span className={styles.issuePill}>{mealIssues.length} check{mealIssues.length === 1 ? "" : "s"}</span>}
            </div>
            {!locked && (
              <div className={styles.mealControls}>
                <button type="button" disabled={i === 0} onClick={() => moveMeal(i, -1)} style={disabledOf(i === 0, iconBtn)} title="Move up">↑</button>
                <button type="button" disabled={i === meals.length - 1} onClick={() => moveMeal(i, 1)} style={disabledOf(i === meals.length - 1, iconBtn)} title="Move down">↓</button>
                <button type="button" onClick={() => removeMeal(i)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete slot">✕</button>
              </div>
            )}
          </div>

          {open && <div className={styles.mealBody}>
          <div className={styles.mealSetupGrid}>
            <div className={styles.mealNameField}><div style={label}>Meal name</div>
              <input disabled={locked} value={m.name} placeholder="Meal name" onChange={(e) => updateMeal(i, { name: e.target.value })} style={{ ...inpControl, fontWeight: 700 }} /></div>
            <div><div style={label}>From</div>
              <input disabled={locked} value={m.time_from ?? ""} placeholder="e.g. 9:30 am" onChange={(e) => updateMeal(i, { time_from: e.target.value || null })} style={inpControl} /></div>
            <div><div style={label}>To</div>
              <input disabled={locked} value={m.time_to ?? ""} placeholder="e.g. 10:00 am" onChange={(e) => updateMeal(i, { time_to: e.target.value || null })} style={inpControl} /></div>
          </div>

          <label className={styles.conditionalField}>
            <input type="checkbox" disabled={locked} checked={m.conditional} onChange={(e) => updateMeal(i, { conditional: e.target.checked })} />
            <span><b>Conditional slot</b><small>Eaten instead of a meal and excluded from the day&apos;s totals</small></span>
          </label>

          <input disabled={locked} value={m.note ?? ""} placeholder="Note for this meal slot (optional)" onChange={(e) => updateMeal(i, { note: e.target.value || null })} style={{ ...inp, width: "100%", boxSizing: "border-box", marginTop: 8 }} />

          {/* Options */}
          <div className={styles.optionsArea}>
            <div className={styles.optionsHeading}>
              <span>Meal options</span>
              <small>Every active slot needs exactly four complete options.</small>
            </div>
            {m.options.map((o, j) => {
              // A built row's calories and protein are the recipes'. The boxes
              // go read-only rather than disappearing, so the figures still
              // read straight across the row the way a typed one does.
              const built = o.components.length > 0;
              const fromRecipe: React.CSSProperties = {
                ...inpControl, background: "var(--neutral-bg)", color: "var(--muted)", fontWeight: 600,
              };
              // Said once per component, on the row, rather than only in the
              // list at the foot of a long page.
              const trouble = o.components.map((c) => {
                const d = dishMap.get(c.dish_id);
                if (!d) return dishes.length ? "one of its recipes is no longer in the library" : null;
                if (c.servings <= 0) return `the ${d.name} portion has to be more than nothing`;
                if (!d.perServing) return `${d.name} can't be priced yet — ${d.reason}`;
                if (!d.approved) return `${d.name} hasn't been approved for use on charts yet`;
                return null;
              }).find(Boolean);
              // Where the figures come from, said plainly. A row added up from
              // published per-serving values is a different kind of number
              // from one this app calculated, and the difference matters when
              // she is deciding whether to trust it on a client's chart.
              const quoted = built && o.components.some((c) => dishMap.get(c.dish_id)?.basis === "published");
              return (
                <div key={o.id ?? `opt-${j}`} className={styles.optionCard}>
                  <div className={styles.optionTitleRow}>
                    <span className={styles.optionNumber}>Option {j + 1}</span>
                    {built && <span className={styles.recipePill}>Recipe calculated</span>}
                    <span className={styles.optionTitleSpacer} />
                    {!locked && <button type="button" onClick={() => removeOption(i, j)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete option">✕</button>}
                  </div>
                  <div className={styles.optionBasicsGrid}>
                    <label><span>Food items</span>
                      <input disabled={locked} value={o.food_items} placeholder="What the client will eat" onChange={(e) => updateOption(i, j, { food_items: e.target.value })} style={inpControl} />
                    </label>
                    <label><span>Measured quantity</span>
                      <input disabled={locked} value={o.qty ?? ""} placeholder="Portion and units" onChange={(e) => updateOption(i, j, { qty: e.target.value || null })} style={inpControl} />
                    </label>
                  </div>
                  <div className={styles.nutritionGrid}>
                    {/* The five figures the issued document prints, in the
                        brief's order. Read-only wherever the row is built from
                        recipes — the recipes decide, and the boxes stay
                        visible so the row still reads straight across. */}
                    {MACROS.map((k) => (
                      <label key={k}><span>{OPTION_NUTRIENT_LABELS[k]}</span>
                        <input type="number" step={k === "kcal" ? "1" : "0.1"}
                          disabled={locked} readOnly={built} value={o[k] ?? ""}
                          onChange={(e) => updateOption(i, j, { [k]: e.target.value === "" ? null : Number(e.target.value) })}
                          style={built ? fromRecipe : inpControl}
                          title={built ? "Added up from the recipes below" : undefined} />
                      </label>
                    ))}
                    {/* ---- KEY MICRONUTRIENTS ----
                        Left as a box she can type in, always. The recipes can
                        work out iron and folate; they cannot know that this
                        client is the one on thyroxine, and the column has
                        carried that sort of remark for as long as the clinic
                        has issued charts.

                        What is new is the suggestion beside it: where an option
                        is built from recipes, the app offers the line it worked
                        out and she takes it with one click. Filling the box for
                        her would overwrite a note somebody meant. */}
                    <label className={styles.micronutrientField}><span>Key micronutrients</span>
                      <input disabled={locked} value={o.micronutrients ?? ""} placeholder="Iron, folate…" onChange={(e) => updateOption(i, j, { micronutrients: e.target.value || null })} style={inpControl} />
                    </label>
                  </div>

                  {/* ---- BUILT FROM ----
                      One line per recipe in the option. Indented under the row
                      it belongs to rather than squeezed into a column, because
                      a breakfast option is routinely four items and a list of
                      four does not fit in a cell. */}
                  {built && dishes.length === 0 && (
                    // The library did not load. Without this the row shows
                    // greyed, uneditable figures, no recipes and no reason —
                    // and no way back to typing them by hand.
                    <div className={styles.optionMessage} style={{ color: "var(--amber-text)" }}>
                      Built from recipes, but the recipe library could not be loaded — reload the page to edit this option.
                    </div>
                  )}

                  {(built || !locked) && dishes.length > 0 && (
                    <div className={styles.recipeBuilder}>
                      {built && <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Built from</span>}
                      {o.components.map((c, k) => (
                        <span key={c.id ?? `part-${k}`} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <select disabled={locked} value={c.dish_id}
                            onChange={(e) => updateComponent(i, j, k, { dish_id: e.target.value }, o)}
                            style={{ ...inpControl, width: "auto", maxWidth: 190, height: 30, fontSize: 12, cursor: locked ? "default" : "pointer" }}>
                            {/* A recipe deleted since this was saved would
                                otherwise vanish from the box and read as
                                whichever dish happened to be first. */}
                            {!dishMap.has(c.dish_id) && <option value={c.dish_id}>Recipe removed</option>}
                            {/* A dish already on the chart stays listed even
                                if approval was withdrawn afterwards, so the
                                box never silently reads as a different
                                recipe. The red check below is what stops it
                                going out. */}
                            {!dishMap.get(c.dish_id)?.approved && dishMap.has(c.dish_id) && (
                              <option value={c.dish_id}>{dishMap.get(c.dish_id)!.name} (not approved)</option>
                            )}
                            {selectable.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}{d.perServing ? "" : " (unpriced)"}</option>
                            ))}
                          </select>
                          <input type="number" step="0.25" min="0.25" disabled={locked} value={c.servings}
                            onChange={(e) => updateComponent(i, j, k, { servings: e.target.value === "" ? 1 : Number(e.target.value) }, o)}
                            style={{ ...inpControl, width: 52, height: 30, fontSize: 12 }}
                            title="How much of one serving — 1 is a portion, 0.5 is half" />
                          {!locked && (
                            <button type="button" onClick={() => removeComponent(i, j, k, o)}
                              style={{ ...iconBtn, width: 24, height: 24, lineHeight: "22px", color: "var(--red-text)" }} title="Remove from this option">✕</button>
                          )}
                        </span>
                      ))}
                      {!locked && selectable.length > 0 && (
                        <button type="button" onClick={() => addComponent(i, j, o)}
                          style={{ ...outlineBtn, padding: "4px 10px", fontSize: 11.5 }}>
                          {built ? "+ Add another recipe" : "+ Build from recipes"}
                        </button>
                      )}
                      {!locked && selectable.length === 0 && !built && (
                        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          No approved recipes yet — approve some under Dishes to build options from them.
                        </span>
                      )}
                    </div>
                  )}

                  {/* ---- WHAT THE RECIPES SAY THE MICRONUTRIENTS ARE ----
                      Offered, never written. The box above is hers: it has
                      always carried remarks the ingredients cannot know — that
                      this client is on thyroxine, that the iron here is the
                      non-haem kind. Filling it automatically would overwrite
                      one of those the first time a recipe changed.

                      So the line sits underneath with a button, and one click
                      puts it in. Nothing appears where the option is typed by
                      hand, because then there is nothing to add up. */}
                  {(() => {
                    if (!built || locked || !dishes.length) return null;
                    const line = micronutrientLine(optionMicronutrients(o.components, dishMap));
                    if (!line || line === o.micronutrients) return null;
                    return (
                      <div className={styles.optionMessage} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>These recipes work out at <b style={{ color: "var(--ink)" }}>{line}</b></span>
                        <button type="button"
                          onClick={() => updateOption(i, j, { micronutrients: line })}
                          style={{ ...outlineBtn, padding: "2px 8px", fontSize: 11 }}>
                          {o.micronutrients?.trim() ? "Replace what is there" : "Use this"}
                        </button>
                      </div>
                    );
                  })()}

                  {!trouble && quoted && (
                    // Not a warning. A published figure is a proper lookup —
                    // she simply needs to know it is the databank's number and
                    // not this app's, because correcting an ingredient will not
                    // move it until the recipe can be computed here.
                    <div className={styles.optionMessage}>
                      Figures quoted from the published recipe, not calculated here.
                    </div>
                  )}

                  {trouble && (
                    <div className={styles.optionMessage} style={{ color: "var(--amber-text)" }}>
                      No figures for this option — {trouble}. Fix it under Dishes, or remove it here and type the numbers.
                    </div>
                  )}
                </div>
              );
            })}
            {!locked && <button type="button" onClick={() => addOption(i)} style={{ ...outlineBtn, marginTop: 8 }}>+ Add option</button>}
          </div>
          </div>}
        </div>
        );
      })}
      {!locked && <button type="button" onClick={addMeal} style={{ ...outlineBtn, marginBottom: 18 }}>+ Add meal slot</button>}

      {/* ---- NOTES ---- */}
      <div className={styles.sectionHeading}>
        <div>
          <div className={styles.eyebrow}>Step 3</div>
          <h3>Add coaching and review context</h3>
          <p>Keep instructions for the client separate from clinical reminders for the care team.</p>
        </div>
      </div>
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Coaching notes</div>
        <textarea disabled={locked} rows={7} value={meta.notes ?? ""} placeholder="3-part meal rule, hydration, tea structure…"
          onChange={(e) => { setMeta((mt) => ({ ...mt, notes: e.target.value || null })); touch(); }}
          style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      </div>

      {/* ---- READ AGAINST WHAT THE CLIENT TAKES ----
          Deliberately below the problems list and deliberately not blocking.
          Almost every one of these is answered by timing rather than by
          changing the food — thyroxine is taken an hour before breakfast so
          that the calcium at breakfast does not matter — and a gate that was
          wrong on most of the charts it stopped would train everybody to click
          through it. */}
      {/* ---- WHO THIS CLIENT IS ----
          Sections 9, 6 and 10. First of the three panels because it is the
          thing most easily forgotten: the blood work and the medicines are
          looked up, but "she is from Chennai" is the sort of fact that lives
          in a conversation and then evaporates. */}
      {notes.length > 0 && (
        <div style={{ ...box, padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            Worth remembering about this client
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
            From the latest diet assessment. Reminders — none of these stops the chart.
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
            {notes.map((n) => <li key={n.id} style={{ marginBottom: 4 }}>{n.text}</li>)}
          </ul>
        </div>
      )}

      {/* ---- WHAT THE BLOOD WORK SAYS ----
          Section 4: "Identify deficiencies from history/lab reports. Include
          appropriate food sources."

          Above the medicines panel because a deficiency is something the chart
          should answer, while an interaction is something it should avoid —
          and the first is the reason she is writing this version. */}
      {findings.length > 0 && (
        <div style={{ ...box, padding: 14, marginTop: 12, background: "var(--amber-bg)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            What the blood work says
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
            The latest result for each marker that sits outside its range. These do not
            stop the chart being sent.
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
            {findings.map((f) => (
              <li key={f.marker} style={{ marginBottom: 5 }}>
                {f.text}
                {/* Named so she can see whether the chart already answers it —
                    the option rows carry the same figure. */}
                {f.answersLabel && (
                  <span style={{ color: "var(--muted)" }}>
                    {" "}The column to watch on this chart is <b>{f.answersLabel}</b>.
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            &ldquo;Low&rdquo; here means below the range on the report, which is a laboratory
            statement rather than a clinical one. Values sit outside a range for reasons
            that have nothing to do with diet, and a real deficiency can sit inside one.
          </div>
        </div>
      )}

      {drugWatch && (
        <div style={{ ...box, padding: 14, marginTop: 12, background: "var(--blue-bg)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            Read against this client&apos;s medicines
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
            Checked for {drugWatch.rules.map((r) => r.label).join(", ")}. These do not stop
            the chart being sent — they are here to be read.
          </div>

          {drugWatch.found.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
              {drugWatch.found.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f.text}</li>)}
            </ul>
          ) : (
            <div style={{ fontSize: 12.5 }}>
              Nothing on this chart trips the {drugWatch.rules.length === 1 ? "rule" : "rules"} for{" "}
              {drugWatch.rules.map((r) => r.label).join(" or ")}.
            </div>
          )}

          {/* An option typed by hand has no minerals to read, and reporting
              nothing found for it would look identical to a clean check. */}
          {drugWatch.unchecked > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--amber-text)", marginTop: 8 }}>
              {drugWatch.unchecked} option{drugWatch.unchecked === 1 ? " was" : "s were"} not
              checked for minerals — {drugWatch.unchecked === 1 ? "it is" : "they are"} typed
              by hand rather than built from recipes, so there is nothing to add up. Named
              foods were still read.
            </div>
          )}

          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            This covers thyroid replacement, diuretics and statins only — the three the
            clinic&apos;s brief names. It is not a drug interaction database, and finding
            nothing here does not mean a chart has none.
          </div>
        </div>
      )}
    </div>
  );
}
