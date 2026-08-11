"use client";

import React, { useMemo, useState } from "react";
import {
  nutrientsOf, dishNutrients, roundNutrients, energySplit, perPortion, wholeRecipe,
  servingProblem, contradictsSource, toGrams, fromGrams, unitsFor, isMassUnit,
  portionLooksOdd, dishMicronutrients, micronutrientsKnown, notableMicronutrients,
  MICRONUTRIENTS,
  type Food, type Nutrients, type Measure, type MicroFood,
} from "@/lib/nutrition";

/**
 * One dish, opened up.
 *
 * The list screen answers "which recipes need work". This answers the next
 * question — "is this one right, and if not, which ingredient is wrong" — which
 * previously meant reading a row of unlabelled input boxes and doing division.
 *
 * TWO THINGS IT DOES DIFFERENTLY FROM THE REST OF THE APP
 *
 * 1. IT SHOWS ONE PORTION, NOT THE POT. A recipe is stored as what goes in:
 *    282 g of potato making three paranthas. Nobody plans a chart in pots. So
 *    every weight on this screen is divided by the servings count, and the
 *    heading says so. What is STORED never changes shape — see `edits` below.
 *
 * 2. IT LETS HER SEE AN INGREDIENT'S OWN FIGURES. Opening a row shows what that
 *    ingredient alone contributes to the portion, which is the only way to
 *    answer "why is this dish 900 calories" without a calculator.
 *
 * Everything recomputes as she types, before anything is saved, because a
 * number she can watch move is a number she can trust.
 */

export type DetailItem = {
  food_code: string | null;
  name: string;
  /** Weight in the WHOLE recipe, as stored. */
  raw_g: number;
  seq: number;
  raw_g_source: string | null;
  note: string | null;
};

export type DetailDish = {
  id: string;
  name: string;
  cuisine: string | null;
  servings: number | null;
  serving_label: string | null;
  cooked_g: number | null;
  notes: string | null;
  source: string | null;
  source_kcal: number | null;
  source_carb_g: number | null;
  source_protein_g: number | null;
  source_fat_g: number | null;
  source_fibre_g: number | null;
  /** Why the source's figures are no longer a second opinion. See 0154. */
  source_superseded: string | null;
  approved: boolean;
  /** Raw ingredient weight of one portion, and whether a person set it. */
  portion_g: number | null;
  portion_g_source: string | null;
  items: DetailItem[];
};

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
};
const inp: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px",
  height: 34, fontSize: 13, background: "#fff", boxSizing: "border-box",
};
const ghost: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};
const step: React.CSSProperties = {
  ...ghost, width: 38, height: 38, fontSize: 17, lineHeight: 1, padding: 0,
};

/** The three macros, in the order the reference lays them out. */
const MACROS = [
  { key: "fat_g", label: "Fat", split: "fat", colour: "#5b8def" },
  { key: "carb_g", label: "Carbs", split: "carb", colour: "#f0a232" },
  { key: "protein_g", label: "Protein", split: "protein", colour: "#e8558a" },
] as const;

/**
 * The energy ring.
 *
 * Three arcs sized by where the energy comes from, drawn only when there is
 * energy to divide. A dish with none gets the calorie figure and no ring at
 * all, rather than a circle implying a split that does not exist.
 */
function EnergyRing({ kcal, split }: { kcal: number; split: ReturnType<typeof energySplit> }) {
  const R = 46, C = 2 * Math.PI * R, GAP = 3;
  let offset = 0;
  const arcs = split
    ? MACROS.map((m) => {
        const pct = split[m.split];
        const len = Math.max(0, (C * pct) / 100 - GAP);
        const a = { colour: m.colour, len, at: offset };
        offset += (C * pct) / 100;
        return a;
      }).filter((a) => a.len > 0)
    : [];
  return (
    <svg width="112" height="112" viewBox="0 0 112 112" aria-hidden>
      <circle cx="56" cy="56" r={R} fill="none" stroke="var(--border)" strokeWidth="9" />
      {arcs.map((a, i) => (
        <circle key={i} cx="56" cy="56" r={R} fill="none" stroke={a.colour} strokeWidth="9"
          strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.at}
          strokeLinecap="round" transform="rotate(-90 56 56)" />
      ))}
      <text x="56" y="53" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--ink)">
        {Math.round(kcal)}
      </text>
      <text x="56" y="70" textAnchor="middle" fontSize="11" fill="var(--muted)">kcal</text>
    </svg>
  );
}

/** Nutrition facts: the four figures and the ring, for a dish or one ingredient. */
function Facts({ n, dense }: { n: Nutrients; dense?: boolean }) {
  const split = energySplit(n);
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: dense ? 16 : 24, flexWrap: "wrap", flex: 1, minWidth: 200 }}>
        {MACROS.map((m) => (
          <div key={m.key}>
            <div style={{ fontSize: 12, fontWeight: 700, color: m.colour }}>{m.label}</div>
            <div style={{ fontSize: dense ? 16 : 21, fontWeight: 700 }}>
              {Math.round(n[m.key] * 10) / 10}g
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
              {split ? `${split[m.split]}%` : "—"}
            </div>
          </div>
        ))}
        <div>
          {/* Fibre has no slice on the ring. It carries a little energy, but a
              fourth arc would imply it competes with the other three for room
              in a meal, which is not how anyone plans one. */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Fibre</div>
          <div style={{ fontSize: dense ? 16 : 21, fontWeight: 700 }}>
            {Math.round(n.fibre_g * 10) / 10}g
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>no energy split</div>
        </div>
      </div>
      {!dense && <EnergyRing kcal={n.kcal} split={split} />}
      {dense && (
        <div style={{ fontSize: 19, fontWeight: 700 }}>
          {Math.round(n.kcal)}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}> kcal</span>
        </div>
      )}
    </div>
  );
}

export default function DishDetail({
  dish, foods, measures, micros, canEdit, onClose, onSave, onRewrite, onTeachMeasure,
  onSavePortion, portionMedian, busy, error,
}: {
  dish: DetailDish;
  foods: Food[];
  /** Every recorded cup, spoon and piece weight, keyed by food code. */
  measures: Map<string, Measure[]>;
  /** Each food's vitamins and minerals per 100 g, keyed by food code. */
  micros: Map<string, MicroFood>;
  canEdit: boolean;
  onClose: () => void;
  /** Given only the ingredients whose weight changed, plus the servings count. */
  onSave: (changes: { servings: number; items: DetailItem[] }) => void;
  /**
   * Out to the full form. This screen corrects weights, which is nearly all of
   * the work; renaming a dish, adding an ingredient or removing one still needs
   * the form that rewrites the recipe wholesale.
   */
  onRewrite: () => void;
  /** Record what one unit of a food weighs, so cups work for it from then on. */
  onTeachMeasure: (foodCode: string, unit: string, grams: number) => void;
  /** What one portion is called and what it weighs. Both hers to correct. */
  onSavePortion: (label: string, grams: string) => void;
  /**
   * The middle portion weight across every dish measured in this one's unit —
   * 260 g for a bowl, 19 g for a biscuit. Null where too few dishes share the
   * unit to have a middle worth comparing against.
   */
  portionMedian: number | null;
  busy?: boolean;
  error?: string | null;
}) {
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.food_code, f])), [foods]);

  /**
   * Weights she has typed, in grams PER PORTION, keyed by ingredient position.
   *
   * Only what she actually edited. Everything else keeps its exact stored
   * weight and is never divided and multiplied back — which is what stops 282
   * quietly becoming 279 because somebody opened the dish and closed it.
   */
  const [edits, setEdits] = useState<Map<number, { amount: string; unit: string }>>(new Map());
  const [servings, setServings] = useState(String(dish.servings ?? 1));
  const [open, setOpen] = useState<number | null>(null);

  /** What one portion is called and weighs, while she is changing it. */
  const [label, setLabel] = useState(dish.serving_label ?? "");
  const [portionG, setPortionG] = useState(
    dish.portion_g != null ? String(Math.round(Number(dish.portion_g))) : "");
  const portionDirty = label.trim() !== (dish.serving_label ?? "")
    || portionG.trim() !== (dish.portion_g != null ? String(Math.round(Number(dish.portion_g))) : "");
  /** A cup weight she is in the middle of supplying, per ingredient. */
  const [teaching, setTeaching] = useState<Map<number, string>>(new Map());

  const unitOf = (i: number) => edits.get(i)?.unit ?? "g";
  const measuresFor = (code: string | null) => (code ? measures.get(code) ?? [] : []);

  /**
   * What she has typed, converted to grams for ONE portion — or a reason it
   * cannot be. A cup of a food nobody has weighed is not a small problem to be
   * rounded past; it is an amount we do not know.
   */
  const editedGrams = (i: number): { g: number; how: string } | { why: string } | null => {
    const e = edits.get(i);
    if (!e) return null;
    if (e.amount.trim() === "") return { why: "type an amount" };
    const c = toGrams(Number(e.amount), e.unit, measuresFor(dish.items[i].food_code));
    return c.ok ? { g: c.grams, how: c.how } : { why: c.why };
  };

  const nServings = Number(servings) > 0 ? Number(servings) : null;

  /** The recipe as it stands with her edits applied — whole-recipe weights. */
  const items = useMemo(() => dish.items.map((it, i) => {
    const e = edits.get(i);
    if (!e || e.amount.trim() === "") return it;
    const c = toGrams(Number(e.amount), e.unit, measuresFor(it.food_code));
    if (!c.ok) return it;
    const w = wholeRecipe(c.grams, nServings);
    return w == null ? it : { ...it, raw_g: w };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dish.items, edits, nServings, measures]);

  const verdict = useMemo(() => dishNutrients(
    { name: dish.name, cooked_g: dish.cooked_g, servings: nServings, items },
    foodMap,
  ), [dish.name, dish.cooked_g, nServings, items, foodMap]);

  const portion = verdict.priced ? roundNutrients(verdict.perServing) : null;

  /**
   * The vitamins and minerals in one portion, worked out one nutrient at a
   * time. Uses the same edited weights as everything else, so correcting an
   * ingredient moves the calcium as well as the calories.
   */
  const micro = useMemo(
    () => dishMicronutrients(items, micros, nServings),
    [items, micros, nServings],
  );
  const microKnown = micronutrientsKnown(micro);
  const notable = notableMicronutrients(micro);
  const [allMicros, setAllMicros] = useState(false);
  const problem = portion ? servingProblem(portion) : null;
  const clash = portion && dish.source_superseded == null && dish.source_kcal != null
    && contradictsSource(portion.kcal, Math.round(Number(dish.source_kcal)));

  /** What one ingredient contributes to ONE portion. */
  const contribution = (it: DetailItem): Nutrients | null => {
    const f = it.food_code ? foodMap.get(it.food_code) : null;
    const g = perPortion(it.raw_g, nServings);
    if (!f || g == null) return null;
    return roundNutrients(nutrientsOf(f, g));
  };

  /**
   * What the amount box shows: her typing, or the stored weight for one
   * portion expressed in whichever unit she has picked.
   */
  const shownAmount = (i: number): string => {
    const e = edits.get(i);
    if (e) return e.amount;
    const g = perPortion(dish.items[i].raw_g, nServings);
    if (g == null) return "";
    const u = unitOf(i);
    const v = fromGrams(g, u, measuresFor(dish.items[i].food_code));
    if (v == null) return "";
    // Grams to a tenth; a cup to two decimals, because 0.3 of a cup and 0.25
    // are different amounts of flour and rounding them together hides that.
    return String(isMassUnit(u) ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);
  };

  /** Change the unit without changing the amount of food she meant. */
  const switchUnit = (i: number, u: string) => {
    const cur = shownAmount(i);
    const from = unitOf(i);
    const ms = measuresFor(dish.items[i].food_code);
    const asG = cur === "" ? null : toGrams(Number(cur), from, ms);
    const v = asG && asG.ok ? fromGrams(asG.grams, u, ms) : null;
    setEdits(new Map(edits).set(i, {
      unit: u,
      amount: v == null ? "" : String(isMassUnit(u) ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100),
    }));
  };

  /** Rows she has changed AND that convert to a real weight. */
  const usable = [...edits.keys()].filter((i) => {
    const r = editedGrams(i);
    return r != null && "g" in r;
  });
  const blocked = [...edits.keys()].filter((i) => {
    const r = editedGrams(i);
    return r != null && "why" in r;
  });
  const dirty = usable.length > 0 || Number(servings) !== dish.servings;

  const save = () => {
    if (!nServings) return;
    onSave({
      servings: nServings,
      // Only the rows she touched AND that converted. A cup of something with
      // no recorded weight is left alone rather than written as a guess.
      items: usable.map((i) => items[i]),
    });
  };

  return (
    <div style={{ ...card, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button type="button" onClick={onClose} style={{ ...ghost, padding: "5px 11px" }}>← Back</button>
        <span style={{ flex: 1 }} />
        {canEdit && (
          <button type="button" onClick={onRewrite} style={ghost}
            title="Rename the dish, or add and remove ingredients">
            Rewrite the recipe
          </button>
        )}
        {canEdit && (
          <button type="button" onClick={save} disabled={!dirty || busy || !nServings}
            style={{
              background: dirty && nServings ? "var(--ink)" : "var(--border)", color: "#fff",
              border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600,
              cursor: dirty && nServings ? "pointer" : "default",
            }}>
            {busy ? "Saving…" : dirty ? "Save changes" : "No changes"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "var(--amber-text)", background: "var(--amber-bg)",
                      border: "1px solid var(--border)", borderRadius: 8, padding: "8px 11px", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <h2 style={{ margin: "0 0 2px", fontSize: 22 }}>{dish.name}</h2>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        {dish.source ?? dish.cuisine ?? "Added here"}
        {!dish.approved && <> · not yet approved for a client&apos;s chart</>}
      </div>

      {/* ---- WHAT ONE PORTION CONTAINS ------------------------------------ */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        Nutrition facts <span style={{ color: "var(--muted)", fontWeight: 500 }}>· one portion</span>
      </div>
      {portion ? <Facts n={portion} /> : (
        <div style={{ fontSize: 13, color: "var(--amber-text)", padding: "10px 0" }}>
          Not priced yet — {verdict.priced ? "" : verdict.reason}.
        </div>
      )}

      {problem && (
        <div style={{ fontSize: 12, color: "var(--amber-text)", marginTop: 8 }}>{problem}</div>
      )}
      {/* A retired source is not a silent one. Anyone comparing this library
          against INDB should be able to see exactly where the two part, and
          why, without reading a migration. */}
      {dish.source_superseded && dish.source_kcal != null && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
          {dish.source} publishes {Math.round(Number(dish.source_kcal))} kcal for one portion,
          which is not used here. {dish.source_superseded}
        </div>
      )}
      {clash && portion && (
        <div style={{ fontSize: 12, color: "var(--amber-text)", marginTop: 4 }}>
          {dish.source} publishes {Math.round(Number(dish.source_kcal))} kcal for one portion.
          The ingredients below come to {portion.kcal}.
        </div>
      )}

      {/* ---- VITAMINS AND MINERALS ----------------------------------------
          Ranked by how much of an adult's day one portion carries, not by the
          raw number — 5 mg of iron matters more than 400 mg of sodium, and
          reading the two side by side would suggest otherwise.

          A nutrient with no total is listed by name rather than left out, so
          "no calcium figure" cannot be mistaken for "no calcium". */}
      {microKnown > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0 0", paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Vitamins and minerals</div>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
              one portion · {microKnown} of {MICRONUTRIENTS.length} could be worked out
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" style={{ ...ghost, padding: "3px 9px", fontSize: 11.5 }}
              onClick={() => setAllMicros(!allMicros)}>
              {allMicros ? "Show the notable ones" : "Show all"}
            </button>
          </div>

          {!allMicros && notable.length > 0 && (
            <div style={{ fontSize: 12.5, marginTop: 8 }}>
              Most of a day&apos;s worth, in order:{" "}
              {notable.map((k) => {
                const m = MICRONUTRIENTS.find((x) => x.key === k)!;
                return `${m.label} ${Math.round((micro[k] as number) * 10) / 10} ${m.unit}`;
              }).join(" · ")}
            </div>
          )}
          {!allMicros && notable.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
              Nothing here reaches a tenth of an adult&apos;s daily requirement, so this
              portion is not a source of any one of them.
            </div>
          )}

          {allMicros && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
                          gap: "6px 16px", marginTop: 10 }}>
              {MICRONUTRIENTS.map((m) => (
                <div key={m.key} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "var(--muted)" }}>{m.label}</span>
                  <span style={{ fontWeight: micro[m.key] == null ? 400 : 600,
                                 color: micro[m.key] == null ? "var(--muted)" : undefined }}>
                    {micro[m.key] == null
                      ? "not known"
                      : `${Math.round((micro[m.key] as number) * 100) / 100} ${m.unit}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {microKnown < MICRONUTRIENTS.length && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
              A nutrient reads &ldquo;not known&rdquo; where one of the ingredients has no published
              figure for it. Adding up the rest would under-report it, which on a chart
              is worse than saying nothing.
            </div>
          )}
        </div>
      )}

      {/* ---- PORTION SIZE -------------------------------------------------
          Steppers as well as a box, because the commonest correction on this
          screen is "this is not one serving, it is four", and four taps beats
          selecting a number and typing over it. */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0 0", paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Portion size</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
          How many portions the whole recipe makes. Raising it makes every portion smaller.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input value={servings} onChange={(e) => setServings(e.target.value)} disabled={!canEdit}
            inputMode="decimal" style={{ ...inp, width: 90, height: 38, fontSize: 15, fontWeight: 600 }} />
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            × {dish.serving_label || "portion"}
          </span>
          {canEdit && (
            <>
              <button type="button" style={step} aria-label="One portion fewer"
                onClick={() => setServings(String(Math.max(0.25, (Number(servings) || 1) - 1)))}>−</button>
              <button type="button" style={step} aria-label="One portion more"
                onClick={() => setServings(String((Number(servings) || 0) + 1))}>+</button>
            </>
          )}
        </div>

        {/* ---- WHAT ONE PORTION IS CALLED, AND WHAT IT WEIGHS ----
            Both arrive worked out rather than measured — the weight from the
            recipe's own arithmetic, the name from whatever the source called
            it — so neither is protected from being corrected. This used to sit
            on the list, where it appeared twice on every row; here the
            ingredients it is derived from are on the same screen. */}
        {canEdit && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>One portion is</span>
            <input value={label} placeholder="1 bowl" onChange={(e) => setLabel(e.target.value)}
              style={{ ...inp, width: 130 }} />
            <input value={portionG} placeholder="g" inputMode="decimal"
              onChange={(e) => setPortionG(e.target.value)}
              style={{ ...inp, width: 84 }} title="Raw ingredient weight of one portion" />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>g of ingredients</span>
            {portionDirty && (
              <button type="button" style={ghost} disabled={busy}
                onClick={() => onSavePortion(label.trim(), portionG.trim())}>
                {busy ? "Saving…" : "Save the portion"}
              </button>
            )}
          </div>
        )}
        {(() => {
          // Checked against other dishes measured the same way, which is the
          // only reference that exists — nobody publishes what a bowl weighs.
          // Says a dish is unlike its neighbours, not that it is wrong.
          const g = Number(portionG);
          const odd = g > 0 ? portionLooksOdd(g, portionMedian) : null;
          return odd ? (
            <div style={{ fontSize: 11.5, color: "var(--amber-text)", marginTop: 6 }}>{odd}</div>
          ) : null;
        })()}
        {dish.portion_g_source === "dietitian" && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
            This weight was set here, so nothing recalculates over it.
          </div>
        )}
      </div>

      {/* ---- INGREDIENTS -------------------------------------------------- */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0 0", paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Ingredients</div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 10px" }}>
          Weights are for a single portion, not the whole recipe. Raw weight, as the
          food table measures them — rice weighed dry, not boiled.
        </div>

        {dish.items.map((it, i) => {
          const c = contribution(items[i]);
          const isOpen = open === i;
          const unmatched = !it.food_code || !foodMap.has(it.food_code);
          return (
            <div key={i} style={{
              border: "1px solid var(--border)", borderRadius: 10, marginBottom: 7,
              background: unmatched ? "var(--amber-bg)" : "#fff",
            }}>
              <button type="button" onClick={() => setOpen(isOpen ? null : i)}
                style={{
                  width: "100%", display: "flex", gap: 10, alignItems: "center", textAlign: "left",
                  background: "none", border: "none", padding: "10px 12px", cursor: "pointer",
                }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {shownAmount(i) === "" ? "no weight yet" : `${shownAmount(i)} ${unitOf(i)}`}
                    {edits.has(i) && " · edited"}
                    {it.raw_g_source === "estimated" && " · estimated weight"}
                    {it.note && ` · ${it.note}`}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "right" }}>
                  {c ? `${c.kcal} kcal` : unmatched ? "not in the food table" : "—"}
                </div>
                <span style={{ color: "var(--muted)", fontSize: 15 }}>{isOpen ? "▾" : "›"}</span>
              </button>

              {isOpen && (
                <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--border)" }}>
                  {(() => {
                    const ms = measuresFor(it.food_code);
                    const avail = unitsFor(ms);
                    const res = editedGrams(i);
                    const u = unitOf(i);
                    const teachable = !isMassUnit(u) && !avail.includes(u as never);
                    return (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>One portion contains</span>
                          <input value={shownAmount(i)} disabled={!canEdit || !nServings} inputMode="decimal"
                            onChange={(e) => setEdits(new Map(edits).set(i, { amount: e.target.value, unit: u }))}
                            style={{ ...inp, width: 92 }} />
                          {/* Units this food can be measured in. Grams, kilos,
                              ounces and pounds always; a cup only where someone
                              has weighed a cup of this particular food. The
                              rest sit under "measure it yourself" below. */}
                          <select value={u} disabled={!canEdit || !nServings}
                            onChange={(e) => switchUnit(i, e.target.value)}
                            style={{ ...inp, width: 108 }}>
                            {avail.map((x) => <option key={x} value={x}>{x}</option>)}
                            {teachable && <option value={u}>{u}</option>}
                            <optgroup label="needs weighing first">
                              {(["cup", "tbsp", "tsp", "ml", "L", "piece", "slice"] as const)
                                .filter((x) => !avail.includes(x))
                                .map((x) => <option key={x} value={x}>{x}…</option>)}
                            </optgroup>
                          </select>
                          {edits.has(i) && (
                            <button type="button" style={ghost} onClick={() => {
                              const m = new Map(edits); m.delete(i); setEdits(m);
                            }}>Undo</button>
                          )}
                        </div>

                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6, marginBottom: 10 }}>
                          {res && "g" in res
                            ? <>= {Math.round(res.g * 10) / 10} g a portion, {Math.round(items[i].raw_g * 10) / 10} g in the whole recipe{res.how && <> · {res.how}</>}</>
                            : res && "why" in res
                              ? <span style={{ color: "var(--amber-text)" }}>Cannot use this: {res.why}.</span>
                              : nServings
                                ? <>{Math.round(items[i].raw_g * 10) / 10} g in the whole recipe</>
                                : "Set how many portions the recipe makes first."}
                        </div>

                        {/* ---- TEACH THE LIBRARY A MEASURE ----
                            Offered the moment she picks a unit nothing has been
                            weighed in. She puts one on the scales once and every
                            recipe in the building can use it afterwards. */}
                        {canEdit && teachable && it.food_code && (
                          <div style={{ background: "var(--amber-bg)", border: "1px solid var(--border)",
                                        borderRadius: 8, padding: "10px 11px", marginBottom: 10 }}>
                            <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                              Nobody has weighed a {u} of <b>{it.name}</b> yet. What does one {u} of it weigh?
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>1 {u} =</span>
                              <input value={teaching.get(i) ?? ""} inputMode="decimal" placeholder="120"
                                onChange={(e) => setTeaching(new Map(teaching).set(i, e.target.value))}
                                style={{ ...inp, width: 88 }} />
                              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>g</span>
                              <button type="button" style={ghost}
                                disabled={!(Number(teaching.get(i)) > 0)}
                                onClick={() => onTeachMeasure(it.food_code!, u, Number(teaching.get(i)))}>
                                Save this measure
                              </button>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                              Saved against the food with your name on it, and used by every
                              recipe from then on — so weigh it rather than estimate it.
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {c ? <Facts n={c} dense /> : (
                    <div style={{ fontSize: 12.5, color: "var(--amber-text)" }}>
                      {unmatched
                        ? "This ingredient is not in the food table, so it cannot be priced. Until it is, the whole recipe stays unpriced rather than counting it as nothing."
                        : "No weight recorded, so this contributes nothing to the figures above — which is why the recipe will not price."}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {dish.items.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No ingredients recorded yet.</div>
        )}
      </div>

      {dirty && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
          Nothing is saved until you press Save changes. Only the ingredients you
          edited are written back; the rest keep the weight they already had.
        </div>
      )}
    </div>
  );
}
