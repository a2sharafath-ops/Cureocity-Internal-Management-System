"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  type PlanMeal, type PlanOption, type PlanTargets, type DishOption,
  mealHeading, planTotals, targetCheck, planProblems, resequence, optionNutrients,
  MACROS, MACRO_LABELS, optionMicronutrients, micronutrientLine,
} from "@/lib/diet-plan";
import { saveDietPlan, submitDietPlan, reviewDietPlan, newDietPlanVersion } from "@/lib/actions";
import DeliverButton from "@/components/DeliverButton";

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

/**
 * The nine columns the clinic's brief specifies, shared by the header and each
 * row: Option, Food Items, Quantity, Calories, Carbs, Protein, Fat, Fibre,
 * Micronutrients — plus the delete button.
 */
const OPT_COLS = "62px 1.5fr 1.1fr 62px 58px 62px 52px 56px 1fr 28px";
/** A blank meal slot — a new "+ Add meal slot" click. */
const blankMeal = (seq: number): PlanMeal => ({ seq, name: "", time_from: null, time_to: null, note: null, conditional: false, options: [] });

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
  planId, clientName, status, version, canReview, initial, dishes, readOnly = false, pdf, whatsapp }: {
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
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    setMeals((ms) => [...ms, blankMeal(ms.length)]);
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

  const pill = statusPill(status);

  return (
    <div>
      {/* ---- HEADER ---- */}
      <div style={{ ...box, padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <b style={{ fontSize: 14 }}>{clientName}</b>
          <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 12.5 }}> · Diet plan v{version}</span>
        </div>
        <span style={{ background: pill.bg, color: pill.fg, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{pill.text}</span>
        <span style={{ flex: 1 }} />
        {locked ? (
          meta.issued_on && <span style={{ fontSize: 12, color: "var(--muted)" }}>Issued {meta.issued_on}</span>
        ) : (
          <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
            Issued
            <input type="date" value={meta.issued_on ?? ""} onChange={(e) => { setMeta((m) => ({ ...m, issued_on: e.target.value || null })); touch(); }} style={{ ...inpControl, width: 150 }} />
          </label>
        )}
        <a href={`/diet-plan/${planId}/print`} target="_blank" rel="noopener" style={{ ...outlineBtn, textDecoration: "none", color: "var(--ink)" }}>Preview PDF →</a>
        {/* One press: makes the stored file, puts it in the portal, sends it.
            Preview above is just a look — it leaves nothing behind.

            Two gates, and both matter. Unresolved checks mean the chart does not
            add up. Anything short of published means nobody has signed it off —
            and WhatsApp has no unsend, so an unapproved draft reaching a patient
            cannot be walked back. The assessment builder has always gated on
            published; this one did not, which is how a draft could be sent. */}
        {status !== "published" ? (
          <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
            Approve and publish before this can be sent
          </span>
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
      {savedAt && !dirty && <div style={{ fontSize: 11.5, color: "var(--green-text)", margin: "-6px 0 10px" }}>Saved at {new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</div>}
      {err && <div style={{ fontSize: 12, color: "var(--red-text)", margin: "-6px 0 10px" }}>{err}</div>}

      {/* ---- TARGETS ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Daily targets</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <div><div style={label}>Calorie target (kcal/day)</div>
            <input type="number" disabled={locked} value={targets.kcal ?? ""} onChange={(e) => { setTargets((t) => ({ ...t, kcal: e.target.value === "" ? null : Number(e.target.value) })); touch(); }} style={inpControl} /></div>
          <div><div style={label}>Protein</div>
            <input disabled={locked} value={targets.protein ?? ""} placeholder="e.g. 90-95 g" onChange={(e) => { setTargets((t) => ({ ...t, protein: e.target.value || null })); touch(); }} style={inpControl} /></div>
          <div><div style={label}>Carbohydrate</div>
            <input disabled={locked} value={targets.carbohydrate ?? ""} placeholder="e.g. 180-200 g" onChange={(e) => { setTargets((t) => ({ ...t, carbohydrate: e.target.value || null })); touch(); }} style={inpControl} /></div>
          <div><div style={label}>Fats</div>
            <input disabled={locked} value={targets.fats ?? ""} placeholder="e.g. 50-60 g" onChange={(e) => { setTargets((t) => ({ ...t, fats: e.target.value || null })); touch(); }} style={inpControl} /></div>
          <div><div style={label}>Fibre</div>
            <input disabled={locked} value={targets.fibre ?? ""} placeholder="e.g. 25-30 g" onChange={(e) => { setTargets((t) => ({ ...t, fibre: e.target.value || null })); touch(); }} style={inpControl} /></div>
          <div><div style={label}>Water</div>
            <input disabled={locked} value={targets.water ?? ""} placeholder="e.g. 2.5 - 3 ltr/day" onChange={(e) => { setTargets((t) => ({ ...t, water: e.target.value || null })); touch(); }} style={inpControl} /></div>
          <div style={{ gridColumn: "span 2" }}><div style={label}>Food allergies</div>
            <input disabled={locked} value={meta.allergies ?? ""} placeholder="e.g. Peanuts, shellfish" onChange={(e) => { setMeta((m) => ({ ...m, allergies: e.target.value || null })); touch(); }} style={inpControl} /></div>
        </div>
      </div>

      {/* ---- LIVE TOTALS ---- */}
      <div style={{
        ...box, padding: "10px 14px", marginBottom: 12,
        background: check.tone === "ok" ? "var(--green-bg)" : check.tone === "warn" ? "var(--amber-bg)" : "var(--card)",
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: check.tone === "ok" ? "var(--green-text)" : check.tone === "warn" ? "var(--amber-text)" : "var(--ink)" }}>
          Combinations range {totals.minKcal}–{totals.maxKcal} kcal
        </div>
        {/* The day's macros as well as its calories, so the header targets can
            be read against what the options actually add up to. Until the chart
            held carbs, fat and fibre this line could only ever say protein. */}
        <div style={{ fontSize: 12, marginTop: 3, color: "var(--muted)" }}>
          {MACRO_LABELS.map(([k, label]) => (
            <span key={k} style={{ marginRight: 12 }}>
              {label} {totals.macros[k].min}–{totals.macros[k].max} g
            </span>
          ))}
        </div>
        {check.text && <div style={{ fontSize: 12, marginTop: 2, color: check.tone === "ok" ? "var(--green-text)" : "var(--amber-text)" }}>{check.text}</div>}
      </div>

      {/* ---- MEAL SLOTS ---- */}
      {meals.map((m, i) => (
        <div key={m.id ?? `meal-${i}`} style={{ ...box, padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input disabled={locked} value={m.name} placeholder="Meal name" onChange={(e) => updateMeal(i, { name: e.target.value })} style={{ ...inpControl, flex: "1 1 220px", fontWeight: 700, width: "auto" }} />
            <input disabled={locked} value={m.time_from ?? ""} placeholder="From (e.g. 9:30 am)" onChange={(e) => updateMeal(i, { time_from: e.target.value || null })} style={{ ...inpControl, width: 140 }} />
            <span style={{ color: "var(--muted)" }}>–</span>
            <input disabled={locked} value={m.time_to ?? ""} placeholder="To (e.g. 10:00 am)" onChange={(e) => updateMeal(i, { time_to: e.target.value || null })} style={{ ...inpControl, width: 140 }} />
            <span style={{ flex: 1 }} />
            {!locked && (
              <>
                <button type="button" disabled={i === 0} onClick={() => moveMeal(i, -1)} style={disabledOf(i === 0, iconBtn)} title="Move up">↑</button>
                <button type="button" disabled={i === meals.length - 1} onClick={() => moveMeal(i, 1)} style={disabledOf(i === meals.length - 1, iconBtn)} title="Move down">↓</button>
                <button type="button" onClick={() => removeMeal(i)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete slot">✕</button>
              </>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{mealHeading(m) || "—"}</div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 8 }}>
            <input type="checkbox" disabled={locked} checked={m.conditional} onChange={(e) => updateMeal(i, { conditional: e.target.checked })} />
            Conditional
            <span style={{ color: "var(--muted)" }}>— Eaten instead of a meal — excluded from the day&apos;s totals</span>
          </label>

          <input disabled={locked} value={m.note ?? ""} placeholder="Note (optional)" onChange={(e) => updateMeal(i, { note: e.target.value || null })} style={{ ...inp, width: "100%", boxSizing: "border-box", marginTop: 8 }} />

          {/* Options table */}
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: OPT_COLS, gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 600, padding: "0 2px" }}>
              <span>Option</span><span>Food items</span><span>Qty</span><span>Kcal</span>
              <span>Carbs (g)</span><span>Protein (g)</span><span>Fat (g)</span><span>Fibre (g)</span>
              <span>Micronutrient</span><span />
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
                <div key={o.id ?? `opt-${j}`} style={{ marginTop: 6, paddingBottom: built ? 6 : 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: OPT_COLS, gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Option {j + 1}</span>
                    <input disabled={locked} value={o.food_items} placeholder="Food items" onChange={(e) => updateOption(i, j, { food_items: e.target.value })} style={inpControl} />
                    <input disabled={locked} value={o.qty ?? ""} placeholder="Measured qty" onChange={(e) => updateOption(i, j, { qty: e.target.value || null })} style={inpControl} />
                    {/* The five figures the issued document prints, in the
                        brief's order. Read-only wherever the row is built from
                        recipes — the recipes decide, and the boxes stay
                        visible so the row still reads straight across. */}
                    {MACROS.map((k) => (
                      <input key={k} type="number" step={k === "kcal" ? "1" : "0.1"}
                        disabled={locked} readOnly={built} value={o[k] ?? ""}
                        onChange={(e) => updateOption(i, j, { [k]: e.target.value === "" ? null : Number(e.target.value) })}
                        style={built ? fromRecipe : inpControl}
                        title={built ? "Added up from the recipes below" : undefined} />
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
                    <input disabled={locked} value={o.micronutrients ?? ""} placeholder="Iron, folate…" onChange={(e) => updateOption(i, j, { micronutrients: e.target.value || null })} style={inpControl} />
                    {!locked && <button type="button" onClick={() => removeOption(i, j)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete option">✕</button>}
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
                    <div style={{ fontSize: 11.5, color: "var(--amber-text)", margin: "4px 0 0 78px" }}>
                      Built from recipes, but the recipe library could not be loaded — reload the page to edit this option.
                    </div>
                  )}

                  {(built || !locked) && dishes.length > 0 && (
                    <div style={{ margin: "4px 0 0 78px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
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
                      <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "3px 0 0 78px",
                                    display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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
                    <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "3px 0 0 78px" }}>
                      Figures quoted from the published recipe, not calculated here.
                    </div>
                  )}

                  {trouble && (
                    <div style={{ fontSize: 11.5, color: "var(--amber-text)", margin: "3px 0 0 78px" }}>
                      No figures for this option — {trouble}. Fix it under Dishes, or remove it here and type the numbers.
                    </div>
                  )}
                </div>
              );
            })}
            {!locked && <button type="button" onClick={() => addOption(i)} style={{ ...outlineBtn, marginTop: 8 }}>+ Add option</button>}
          </div>

          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{slotRangeText(m)}</div>
        </div>
      ))}
      {!locked && <button type="button" onClick={addMeal} style={{ ...outlineBtn, marginBottom: 12 }}>+ Add meal slot</button>}

      {/* ---- NOTES ---- */}
      <div style={{ ...box, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Coaching notes</div>
        <textarea disabled={locked} rows={7} value={meta.notes ?? ""} placeholder="3-part meal rule, hydration, tea structure…"
          onChange={(e) => { setMeta((mt) => ({ ...mt, notes: e.target.value || null })); touch(); }}
          style={{ ...inp, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      </div>

      {/* ---- PROBLEMS ---- */}
      {problems.length > 0 && (
        <div style={{ ...box, padding: 14, marginBottom: 12, background: "var(--red-bg)" }}>
          {/* Named by the step being blocked right now, rather than listing
              every step it could block — the reader only has one next move. */}
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--red-text)", marginBottom: 6 }}>
            {status === "draft" ? "Resolve before this chart can go for review"
              : status === "in_review" ? "Resolve before this chart can be approved"
                : "Resolve before this chart can be sent to the client"}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--red-text)", fontSize: 12.5 }}>
            {problems.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
