"use client";

import { useEffect, useState, useTransition } from "react";
import {
  type PlanMeal, type PlanOption, type PlanTargets,
  mealHeading, planTotals, targetCheck, planProblems, resequence,
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

/** A blank option row — a new "+ Add option" click. */
const blankOption = (seq: number): PlanOption => ({ seq, food_items: "", qty: "", kcal: null, protein_g: null, micronutrients: "" });
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
  planId, clientName, status, version, canReview, initial, readOnly = false, pdf, whatsapp }: {
  planId: string;
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

  const totals = planTotals(meals);
  const check = targetCheck(totals, targets.kcal);
  const problems = planProblems(meals, targets);

  const handleSave = () => {
    setErr(null);
    startSave(async () => {
      const mealsIn = meals.map((m, i) => ({
        seq: i, name: m.name, time_from: m.time_from, time_to: m.time_to, note: m.note, conditional: m.conditional,
        options: m.options.map((o, j) => ({ seq: j, food_items: o.food_items, qty: o.qty, kcal: o.kcal, protein_g: o.protein_g, micronutrients: o.micronutrients })),
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
            Withheld entirely while the chart has unresolved checks: a chart that
            does not add up must not reach a client, and the server refuses it
            too, so a disabled button here is the courtesy and that is the rule. */}
        {problems.length === 0 ? (
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
            <form action={submitDietPlan}>
              <input type="hidden" name="id" value={planId} />
              <button disabled={problems.length > 0} style={disabledOf(problems.length > 0, darkBtn)} title={problems.length ? "Resolve the problems below first" : undefined}>Submit for review</button>
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
                      unresolved checks are exactly what you send a chart back for. */}
                  <button disabled={problems.length > 0} style={disabledOf(problems.length > 0, greenBtn)}
                    title={problems.length ? "Resolve the checks below first" : undefined}>Approve &amp; publish</button>
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
          Combinations range {totals.minKcal}–{totals.maxKcal} kcal · protein {totals.minProtein}–{totals.maxProtein} g
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
            <div style={{ display: "grid", gridTemplateColumns: "72px 1.6fr 1.2fr 80px 90px 1.2fr 28px", gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 600, padding: "0 2px" }}>
              <span>Option</span><span>Food items</span><span>Qty</span><span>Kcal</span><span>Protein (g)</span><span>Micronutrient</span><span />
            </div>
            {m.options.map((o, j) => (
              <div key={o.id ?? `opt-${j}`} style={{ display: "grid", gridTemplateColumns: "72px 1.6fr 1.2fr 80px 90px 1.2fr 28px", gap: 6, marginTop: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Option {j + 1}</span>
                <input disabled={locked} value={o.food_items} placeholder="Food items" onChange={(e) => updateOption(i, j, { food_items: e.target.value })} style={inpControl} />
                <input disabled={locked} value={o.qty ?? ""} placeholder="Measured qty" onChange={(e) => updateOption(i, j, { qty: e.target.value || null })} style={inpControl} />
                <input type="number" disabled={locked} value={o.kcal ?? ""} onChange={(e) => updateOption(i, j, { kcal: e.target.value === "" ? null : Number(e.target.value) })} style={inpControl} />
                <input type="number" step="0.1" disabled={locked} value={o.protein_g ?? ""} onChange={(e) => updateOption(i, j, { protein_g: e.target.value === "" ? null : Number(e.target.value) })} style={inpControl} />
                <input disabled={locked} value={o.micronutrients ?? ""} placeholder="Iron, folate…" onChange={(e) => updateOption(i, j, { micronutrients: e.target.value || null })} style={inpControl} />
                {!locked && <button type="button" onClick={() => removeOption(i, j)} style={{ ...iconBtn, color: "var(--red-text)" }} title="Delete option">✕</button>}
              </div>
            ))}
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
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--red-text)", marginBottom: 6 }}>Resolve before this chart can be approved or sent</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--red-text)", fontSize: 12.5 }}>
            {problems.map((p, i) => <li key={i} style={{ marginBottom: 3 }}>{p}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
