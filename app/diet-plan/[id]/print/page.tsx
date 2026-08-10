import { Fragment } from "react";
import { notFound } from "next/navigation";
import { printClient } from "@/lib/print-access";
import { IST } from "@/lib/datetime";
import { getAppSettings, brandLogo } from "@/lib/settings";
import PrintTrigger from "@/components/PrintTrigger";
import { HOW_TO_USE, mealHeading, type PlanMeal, type PlanOption, parseNotes } from "@/lib/diet-plan";

export const dynamic = "force-dynamic";

// Branded PDF for the customised diet plan — the document as the clinic
// actually hands it over: a full-bleed coral cover with the day's targets and
// "how to use" points, then a black meal-plan section with one card per slot,
// then coaching notes. @page margin is 0 (unlike the white letterhead prints)
// because the cover and meal-plan backgrounds must run to the paper edge —
// a nonzero @page margin would leave a white gutter around the colour.
//
// Access: staff read any plan (is_staff() policy). A client reads their own
// plan only once it is published AND shared — the diet_plans_client RLS
// policy already encodes exactly that pair of conditions, so (as with
// consult/print, rx/print and lab/print) no extra profile check is needed
// here: an unauthorized row simply doesn't come back, and we 404.
export default async function DietPlanPrintPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string; doc_token?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  // A renderer has no session, so a valid one-document token unlocks the
  // read. See lib/print-access.ts.
  const supabase = await printClient("plan", params.id, searchParams.doc_token);

  const { data } = await supabase
    .from("diet_plans")
    .select("id, client_id, status, issued_on, kcal, protein, carbohydrate, fats, fibre, water, allergies, notes, how_to_use, shared_at, created_at, clients(name, code)")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();

  const plan = data as unknown as {
    id: string; status: string; issued_on: string | null;
    kcal: number | null; protein: string | null; carbohydrate: string | null;
    fats: string | null; fibre: string | null; water: string | null;
    allergies: string | null; notes: string | null;
    how_to_use: [string, string][] | null;
    created_at: string;
    clients: { name: string; code: string | null } | null;
  };

  const { data: mealRows } = await supabase
    .from("diet_plan_meals")
    .select("id, seq, name, time_from, time_to, note, conditional")
    .eq("plan_id", plan.id)
    .order("seq");
  const meals = (mealRows ?? []) as Omit<PlanMeal, "options">[];

  const mealIds = meals.map((m) => m.id!).filter(Boolean);
  const { data: optionRows } = mealIds.length
    ? await supabase
        .from("diet_plan_options")
        .select("id, meal_id, seq, food_items, qty, kcal, carb_g, protein_g, fat_g, fibre_g, micronutrients")
        .in("meal_id", mealIds)
        .order("seq")
    : { data: [] as never[] };

  const optionsByMeal = new Map<string, PlanOption[]>();
  for (const o of ((optionRows ?? []) as (PlanOption & { meal_id: string })[])) {
    const arr = optionsByMeal.get(o.meal_id) ?? [];
    arr.push(o);
    optionsByMeal.set(o.meal_id, arr);
  }
  const mealsWithOptions: PlanMeal[] = meals.map((m) => ({ ...m, options: optionsByMeal.get(m.id!) ?? [] }));

  const settings = await getAppSettings();
  const logo = brandLogo(settings);
  const clientName = plan.clients?.name ?? "Client";
  const clientCode = plan.clients?.code ?? "—";

  const issuedDate = plan.issued_on ? ddmmyyyyFromDateOnly(plan.issued_on) : ddmmyyyyFromTimestamp(plan.created_at);
  const howToUse: [string, string][] = plan.how_to_use && plan.how_to_use.length > 0 ? plan.how_to_use : HOW_TO_USE;

  const targetRows: [string, string | null][] = [
    ["Daily Calorie Target", plan.kcal != null ? `${plan.kcal} kcal` : null],
    ["Protein", plan.protein],
    ["Carbohydrate", plan.carbohydrate],
    ["Fats", plan.fats],
    ["Fiber", plan.fibre],
    ["Water Intake", plan.water],
  ].filter(([, v]) => !!v?.trim()) as [string, string][];

  const CORAL = "#F14A55";

  // Uploaded cover / page-frame artwork for this flowing document. With
  // neither set, the page renders exactly as the built-in coral design
  // always has — see the two branches below.
  const docPlan = settings.docs.plan;
  const hasCover = !!docPlan.cover?.trim();
  const hasFrame = !!docPlan.bg?.trim();

  const mealPlanContent = (
    <>
      <div style={{ fontSize: 26, fontWeight: 300, marginBottom: 8 }}>Meal Plan</div>
      <div style={{ height: 1, background: "rgba(255,255,255,.3)", marginBottom: 26 }} />

      {mealsWithOptions.map((m) => (
        <div className="meal-card" key={m.id}>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: m.note ? 2 : 10 }}>{mealHeading(m)}</div>
          {m.note && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.65)", fontStyle: "italic", marginBottom: 10 }}>{m.note}</div>}

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, background: "#fff", borderRadius: 6, overflow: "hidden" }}>
            {/* The nine columns of the clinic's brief. Narrow, because the
                document is A4 and four macros now share the space two used. */}
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "17%" }} />
            </colgroup>
            <thead>
              <tr>
                {["Food Items", "Qty", "Calories", "Carbs (g)", "Protein (g)", "Fat (g)", "Fibre (g)", "Micronutrient"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "8px 10px", background: CORAL, color: "#fff",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.options.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "12px 10px", color: "#9ca3af", fontStyle: "italic" }}>No options added.</td></tr>
              ) : m.options.map((o, i) => (
                <Fragment key={o.id ?? i}>
                  <tr>
                    <td colSpan={8} style={{ background: "#e6e6e6", color: "#111", fontWeight: 700, fontSize: 11, padding: "5px 10px" }}>
                      Option {i + 1}
                    </td>
                  </tr>
                  <tr style={{ background: i % 2 === 0 ? "#ffffff" : "#f7f7f7" }}>
                    <td style={{ padding: "8px 10px", color: "#111", verticalAlign: "top", borderBottom: "1px solid #eee" }}>{o.food_items}</td>
                    <td style={{ padding: "8px 10px", color: "#111", verticalAlign: "top", borderBottom: "1px solid #eee" }}>{o.qty || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "#111", verticalAlign: "top", borderBottom: "1px solid #eee" }}>{o.kcal ?? "—"}</td>
                    {([o.carb_g, o.protein_g, o.fat_g, o.fibre_g] as (number | null)[]).map((v, k) => (
                      <td key={k} style={{ padding: "8px 10px", color: "#111", verticalAlign: "top", borderBottom: "1px solid #eee" }}>{v != null ? Number(v) : "—"}</td>
                    ))}
                    <td style={{ padding: "8px 10px", color: "#b3323c", fontSize: 10.5, verticalAlign: "top", borderBottom: "1px solid #eee" }}>{o.micronutrients || "—"}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ---------------- Notes ---------------- */}
      {plan.notes?.trim() && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1px", marginBottom: 10 }}>NOTES</div>
          {/* Rendered with its own structure rather than as one pre-wrapped
              block: the notes are the most practical page of the plan, and
              flattened into a wall of text nobody reads them. Headings,
              numbered steps and bullets come out as the dietitian typed
              them — see parseNotes. */}
          <div style={{ fontSize: 12, lineHeight: 1.65, color: "rgba(255,255,255,.92)" }}>
            {parseNotes(plan.notes).map((l, i) =>
              l.kind === "blank" ? <div key={i} style={{ height: 9 }} />
              : l.kind === "heading" ? <div key={i} style={{ fontWeight: 800, color: "#fff", marginTop: i ? 12 : 0, marginBottom: 3 }}>{l.text}</div>
              : l.kind === "item" ? (
                <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 4, marginBottom: 2 }}>
                  <span style={{ color: CORAL, flexShrink: 0 }}>•</span><span>{l.text}</span>
                </div>
              ) : <div key={i} style={{ marginBottom: 2 }}>{l.text}</div>,
            )}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div style={{ background: "#e5e5e5" }}>
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        @media print {
          .no-print { display: none !important; }
          .page { box-shadow: none !important; margin: 0 !important; }
        }
        @media screen {
          .page { box-shadow: 0 2px 18px rgba(0,0,0,.25); margin: 0 auto 16px; }
        }
        .page { position: relative; width: 210mm; min-height: 297mm; padding: 16mm 14mm; }
        .cover { background: ${CORAL}; color: #fff; page-break-after: always; break-after: page; }
        .body-page { background: #0d0d0d; color: #fff; }
        .meal-card { page-break-inside: avoid; break-inside: avoid; margin-bottom: 24px; background: #161616; border-radius: 10px; padding: 14px 16px; }
        /* Uploaded page frame for the flowing meal-plan section — repeats on
           every printed page behind the content, same pattern as SheetPage. */
        .plan-bg { position: fixed; inset: 0; width: 210mm; height: 297mm; left: 50%; transform: translateX(-50%); object-fit: cover; z-index: 0; }
        .plan-body { position: relative; z-index: 1; }
        @media screen { .plan-bg { position: absolute; transform: none; left: 0; } }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "center", padding: "14px 10px" }}>
        <PrintTrigger auto={searchParams?.auto === "1"} />
      </div>

      {/* ---------------- Cover ---------------- */}
      {hasCover ? (
        // Uploaded cover art, full-bleed at A4 — replaces the built-in coral
        // cover entirely. The coral cover remains the fallback below.
        (<div className="page cover" style={{ padding: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={docPlan.cover} alt="" style={{ position: "absolute", inset: 0, width: "210mm", height: "297mm", objectFit: "cover", display: "block" }} />
        </div>)
      ) : (
      <div className="page cover" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", display: "grid", placeItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="Cureocity" style={{ maxWidth: 24, maxHeight: 24, display: "block" }} />
          </div>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.3px" }}>Cureocity</span>
        </div>

        <div style={{ fontSize: 40, fontWeight: 300, lineHeight: 1.15, marginBottom: 22 }}>
          <div>{clientName}&apos;s</div>
          <div>Customized Diet Plan</div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,.55)", marginBottom: 18 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".5px" }}>
            CLIENT ID&nbsp;&nbsp;{clientCode}
          </div>
          <div style={{ border: "1px solid #fff", borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 600 }}>
            Issued&nbsp;&nbsp;{issuedDate}
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1px", marginBottom: 12 }}>HOW TO USE</div>
        <div style={{ display: "grid", gap: 7, marginBottom: 26 }}>
          {howToUse.map(([label, desc], i) => (
            <div key={i} style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700 }}>{i + 1}. {label}:</span>{" "}
              <span style={{ fontWeight: 400 }}>{desc}</span>
            </div>
          ))}
        </div>

        {targetRows.length > 0 && (
          <div style={{ borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
            {targetRows.map(([label, value], i) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#fff", color: "#111", padding: "9px 16px", fontSize: 12.5,
                borderTop: i ? "1px solid #f0f0f0" : "none",
              }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ fontWeight: 800 }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1px", marginBottom: 6 }}>FOOD ALLERGIES</div>
        <div style={{ fontSize: 12.5 }}>{plan.allergies?.trim() || "Nil"}</div>
      </div>
      )}

      {/* ---------------- Meal Plan ---------------- */}
      {hasFrame ? (
        <div className="page body-page" style={{ fontFamily: "system-ui, -apple-system, sans-serif", padding: `${docPlan.top}mm ${docPlan.side}mm ${docPlan.bottom}mm` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={docPlan.bg} alt="" className="plan-bg" />
          <div className="plan-body">{mealPlanContent}</div>
        </div>
      ) : (
        <div className="page body-page" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
          {mealPlanContent}
        </div>
      )}
    </div>
  );
}

/** "YYYY-MM-DD" (a plain date column, not a timestamp) → "DD-MM-YYYY". No
 *  timezone conversion — the value is already a clinic-local calendar date. */
function ddmmyyyyFromDateOnly(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

/** timestamptz → "DD-MM-YYYY" in clinic-local time. Used as a fallback only
 *  when a plan has no `issued_on` set. */
function ddmmyyyyFromTimestamp(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: IST }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}
