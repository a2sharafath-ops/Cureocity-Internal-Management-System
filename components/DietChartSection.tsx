"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createDietPlan, createDietAssessment, generateDietPlan } from "@/lib/actions";
import { DEFAULT_MEALS, type PlanMeal, type PlanTargets, type DishOption } from "@/lib/diet-plan";
import { type Assessment } from "@/lib/diet-assessment";
import { todayISO } from "@/lib/today";
import DietPlanBuilder, { type PlanMeta } from "@/components/DietPlanBuilder";
import DietAssessmentBuilder from "@/components/DietAssessmentBuilder";
import { type LabResult } from "@/lib/lab-results";

export type DietPlanRow = {
  id: string;
  client_id: string;
  client_name: string | null;
  version: number;
  status: string;
  created_at: string;
  targets: PlanTargets;
  meta: PlanMeta;
  meals: PlanMeal[];
  sharedAt: string | null;
};

export type DietAssessmentRow = {
  id: string;
  client_id: string;
  client_name: string | null;
  version: number;
  status: string;
  created_at: string;
  issued_on: string | null;
  sharedAt: string | null;
  /** From the client record — not versioned, carried along for the BMR hint. */
  dob: string | null;
  gender: string | null;
  assessment: Assessment;
};

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const darkBtn: React.CSSProperties = { background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600 };

const pillOf = (status: string) => {
  if (status === "published") return { bg: "var(--green-bg)", fg: "var(--green-text)", text: "Published" };
  if (status === "in_review") return { bg: "var(--blue-bg)", fg: "var(--blue-text)", text: "In review" };
  if (status === "archived") return { bg: "var(--neutral-bg)", fg: "var(--muted)", text: "Archived" };
  return { bg: "var(--amber-bg)", fg: "var(--amber-text)", text: "Draft" };
};

const blankAssessment = (): Assessment => ({
  consulted_on: null, dietitian: null, medical_history: null, existing_condition: null, medications: [], allergies: null, family_history: null,
  occupation: null, daily_activity: null, exercise: [], sleep_hours: null, sleep_quality: null, stress_level: null, gut_health: null, weight_change: null,
  region: null, shift_pattern: null, outside_meals: null,
  diet_type: null, food_allergies: null, food_dislikes: null, supplements: null,
  height: null, weight: null, bmi: null, bmr: null, tee: null, muscle_mass: null, fat_mass: null, body_fat: null, visceral_fat: null, waist_hip: null,
  primary_goals: null, target_weight: null, timeline_weeks: null, objectives: null,
  meal_frequency: null, meals_per_day: null, snacking: null, hydration: null,
  notes: null,
});

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

type View = "assessment" | "chart";

/**
 * The dietitian's one screen for a client's nutrition paperwork.
 *
 * The assessment and the chart used to be two independent sections stacked on
 * the same tab, each with its own client dropdown and its own version list —
 * so writing up one client meant choosing them twice, and it was possible to
 * have the assessment open for one client and the chart for another without
 * noticing. They are two halves of one job: what was found, and what to eat.
 *
 * So: pick the client ONCE, then switch halves. The newest version of each
 * opens by itself, because the version people want is almost always the latest;
 * older ones are one click away in the strip.
 */
export default function DietChartSection({
  plans, assessments, clients, dishes, medsByClient, labsByClient, canReview, canCompose, pdf, whatsapp }: {
  plans: DietPlanRow[];
  assessments: DietAssessmentRow[];
  clients: { id: string; name: string }[];
  /** The recipe library, priced per serving, for the chart's dish picker. */
  dishes: DishOption[];
  /** Active medicine names per client, for the food-drug check. */
  medsByClient: Record<string, string[]>;
  /** Lab values per client, for section 4's deficiency panel. */
  labsByClient: Record<string, LabResult[]>;
  /** Can approve/send-back a document awaiting sign-off. */
  canReview: boolean;
  pdf: { ready: boolean; missing: string[] };
  whatsapp?: { ready: boolean; missing: string[] };
  /** Can author at all (role gate + workspace read-only combined). */
  canCompose: boolean;
}) {
  const focusClient = useSearchParams().get("client") ?? "";
  const [selectedClient, setSelectedClient] = useState(focusClient);
  const [view, setView] = useState<View>("chart");
  const [planId, setPlanId] = useState<string | null>(null);
  const [assessId, setAssessId] = useState<string | null>(null);
  // Optimistic copies of a just-created document — the real rows only appear
  // once the page's realtime subscription refetches.
  const [newPlan, setNewPlan] = useState<DietPlanRow | null>(null);
  const [newAssess, setNewAssess] = useState<DietAssessmentRow | null>(null);
  const [creating, startCreate] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  /** What the draft-from-consultations run reported back. */
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (newPlan && plans.some((p) => p.id === newPlan.id)) setNewPlan(null);
  }, [plans, newPlan]);
  useEffect(() => {
    if (newAssess && assessments.some((a) => a.id === newAssess.id)) setNewAssess(null);
  }, [assessments, newAssess]);

  const allPlans = newPlan ? [newPlan, ...plans.filter((p) => p.id !== newPlan.id)] : plans;
  const allAssess = newAssess ? [newAssess, ...assessments.filter((a) => a.id !== newAssess.id)] : assessments;

  const planVersions = useMemo(
    () => allPlans.filter((p) => p.client_id === selectedClient).sort((a, b) => b.version - a.version),
    [allPlans, selectedClient],
  );
  const assessVersions = useMemo(
    () => allAssess.filter((a) => a.client_id === selectedClient).sort((a, b) => b.version - a.version),
    [allAssess, selectedClient],
  );

  // Open the newest of each by default. Without this the screen greets you with
  // a list of one row that you then have to click — a step that carried no
  // information. Explicitly choosing an older version wins over the default.
  useEffect(() => {
    setPlanId((cur) => (cur && planVersions.some((p) => p.id === cur) ? cur : planVersions[0]?.id ?? null));
  }, [planVersions]);
  useEffect(() => {
    setAssessId((cur) => (cur && assessVersions.some((a) => a.id === cur) ? cur : assessVersions[0]?.id ?? null));
  }, [assessVersions]);

  const plan = allPlans.find((p) => p.id === planId) ?? null;
  const assess = allAssess.find((a) => a.id === assessId) ?? null;
  const clientName = clients.find((c) => c.id === selectedClient)?.name ?? null;

  const pickClient = (id: string) => {
    setSelectedClient(id);
    setPlanId(null); setAssessId(null);
    setNewPlan(null); setNewAssess(null);
    setErr(null); setNote(null);
  };

  const startNew = (which: View) => {
    if (!selectedClient) { setErr("Select a client first."); return; }
    setErr(null);
    startCreate(async () => {
      const fd = new FormData();
      fd.set("client_id", selectedClient);
      if (which === "chart") {
        const r = await createDietPlan(fd);
        if (r.error) { setErr(r.error); return; }
        if (!r.id) return;
        setNewPlan({
          id: r.id, client_id: selectedClient, client_name: clientName,
          version: planVersions.length + 1, status: "draft", created_at: new Date().toISOString(),
          targets: {
            kcal: null,
            protein: { min: null, max: null }, carbohydrate: { min: null, max: null },
            fats: { min: null, max: null }, fibre: { min: null, max: null }, water: null,
          },
          meta: { allergies: null, notes: null, issued_on: todayISO() },
          meals: DEFAULT_MEALS.map((m) => ({ ...m, options: [] })),
          sharedAt: null,
        });
        setPlanId(r.id);
      } else {
        const r = await createDietAssessment(fd);
        if (r.error) { setErr(r.error); return; }
        if (!r.id) return;
        setNewAssess({
          id: r.id, client_id: selectedClient, client_name: clientName,
          version: assessVersions.length + 1, status: "draft", created_at: new Date().toISOString(),
          issued_on: todayISO(), sharedAt: null, dob: null, gender: null,
          assessment: blankAssessment(),
        });
        setAssessId(r.id);
      }
    });
  };

  /**
   * Draft both documents from what the clinic already knows.
   *
   * The assessment summary first, because it is built deterministically from
   * the client record and the InBody and costs nothing; then the chart, which
   * asks a model to choose recipes and prices them here. A full page reload
   * afterwards rather than patching state by hand: what comes back is a whole
   * chart of slots and options, and pretending to know its shape on the client
   * is how the two drift apart.
   */
  const generate = () => {
    if (!selectedClient) { setErr("Select a client first."); return; }
    setErr(null); setNote(null);
    startCreate(async () => {
      const fd = new FormData();
      fd.set("client_id", selectedClient);
      if (!assessVersions.length) await createDietAssessment(fd);
      const r = await generateDietPlan(fd);
      if (r.error) { setErr(r.error); return; }
      setNote(r.note ?? "Draft ready.");
      router.refresh();
    });
  };

  const versions = view === "chart" ? planVersions : assessVersions;
  const openId = view === "chart" ? planId : assessId;
  const setOpenId = view === "chart" ? setPlanId : setAssessId;
  const noun = view === "chart" ? "chart" : "assessment";

  // The worklist.
  //
  // A dropdown hid the work: to find who was still owed a chart you had to open
  // each client in turn. The list states where both documents stand up front and
  // puts the unstarted ones first, so opening the tab answers "what do I owe?"
  // without a click. A client is ranked by whichever of their two documents is
  // furthest behind — a published chart with no assessment is still work.
  const roster = useMemo(() => {
    const latest = <T extends { client_id: string; version: number }>(rows: T[], cid: string) =>
      rows.filter((r) => r.client_id === cid).sort((a, b) => b.version - a.version)[0] ?? null;
    const rank = (s: string | null | undefined) =>
      s == null ? 0 : s === "draft" ? 1 : s === "in_review" ? 2 : s === "published" ? 3 : 4;

    // The dietitian's roster, PLUS anyone who already has a chart or assessment.
    //
    // Scoping to the roster alone silently hid a client who had a published
    // chart but no dietitian on their care team — the author could no longer
    // reach her own work. Existing paperwork is proof enough that the client
    // belongs on this screen, whatever the care team happens to say.
    const seen = new Set(clients.map((c) => c.id));
    const extra: { id: string; name: string }[] = [];
    for (const r of [...allPlans, ...allAssess]) {
      if (seen.has(r.client_id)) continue;
      seen.add(r.client_id);
      extra.push({ id: r.client_id, name: r.client_name ?? "Unnamed client" });
    }

    return [...clients, ...extra]
      .map((c) => {
        const p = latest(allPlans, c.id);
        const a = latest(allAssess, c.id);
        return { ...c, plan: p, assess: a, order: Math.min(rank(p?.status), rank(a?.status)) };
      })
      .sort((x, y) => x.order - y.order || x.name.localeCompare(y.name));
  }, [clients, allPlans, allAssess]);

  /** One document's standing, as a pill. Absent is the loudest state — it's the work. */
  const standing = (label: string, row: { status: string; sharedAt: string | null } | null) => {
    if (!row) {
      return (
        <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>
          No {label.toLowerCase()} yet
        </span>
      );
    }
    const pill = pillOf(row.status);
    return (
      <span style={{ background: pill.bg, color: pill.fg, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>
        {label} · {pill.text}{row.status === "published" && row.sharedAt ? ` · sent ${fmtDate(row.sharedAt)}` : ""}
      </span>
    );
  };

  const tabBtn = (key: View): React.CSSProperties => ({
    border: "none", background: "none", padding: "9px 2px", marginRight: 20, fontSize: 13.5,
    fontWeight: view === key ? 700 : 500, color: view === key ? "var(--ink)" : "var(--muted)",
    borderBottom: view === key ? "2px solid var(--ink)" : "2px solid transparent",
    cursor: "pointer",
  });

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        Your clients, and where each one&apos;s write-up stands. Anything not started sits at the top. Open a client for both halves: the assessment records what was found, the chart is what they eat from.
      </div>

      {err && <div style={{ fontSize: 12, color: "var(--red-text)", marginBottom: 10 }}>{err}</div>}

      <div style={{ ...box, overflow: "hidden" }}>
        {roster.length === 0 && (
          <div style={{ padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            No clients on your list yet.
          </div>
        )}
        {roster.map((c) => {
          const open = selectedClient === c.id;
          return (
            <div key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => (open ? pickClient("") : pickClient(c.id))}
                aria-expanded={open}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  padding: "12px 14px", border: "none", background: open ? "var(--neutral-bg)" : "#fff",
                  cursor: "pointer", textAlign: "left", font: "inherit",
                }}
              >
                <b style={{ fontSize: 13.5 }}>{c.name}</b>
                {standing("Assessment", c.assess)}
                {standing("Chart", c.plan)}
                <span style={{ flex: 1 }} />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{open ? "Close ▲" : "Open ▼"}</span>
              </button>

              {open && (
                <div style={{ padding: "0 14px 16px" }}>
                  {canCompose && (
                    <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => startNew(view)} disabled={creating}
                        style={{ ...darkBtn, cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1 }}>
                        {creating ? "Working…" : view === "chart" ? "+ New chart" : "+ New assessment"}
                      </button>

                      {/* Reads every write-up on this client and drafts both
                          documents. Not a shortcut past the dietitian: it picks
                          recipes from the approved library, the app prices them,
                          and what lands is a draft with every check still to
                          pass. Deliberately the second button, not the first. */}
                      <button type="button" onClick={generate} disabled={creating}
                        style={{
                          border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
                          padding: "7px 14px", fontSize: 13, fontWeight: 600,
                          cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1,
                        }}
                        title="Reads the consultation summaries, InBody and reports, then drafts a chart from approved recipes">
                        {creating ? "Drafting…" : "✦ Draft from consultations"}
                      </button>
                      {creating && (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          Reading the write-ups and choosing recipes — this takes a few seconds.
                        </span>
                      )}
                    </div>
                  )}
                  {note && (
                    <div style={{ ...box, padding: "10px 14px", marginBottom: 12, background: "var(--green-bg)", color: "var(--green-text)", fontSize: 12.5 }}>
                      {note}
                    </div>
                  )}
                  {/* The two halves. */}
          <div style={{ borderBottom: "1px solid var(--border)", marginBottom: 14, display: "flex", alignItems: "center" }}>
            <button type="button" onClick={() => setView("assessment")} style={tabBtn("assessment")}>
              Assessment{assessVersions.length ? ` (${assessVersions.length})` : ""}
            </button>
            <button type="button" onClick={() => setView("chart")} style={tabBtn("chart")}>
              Chart{planVersions.length ? ` (${planVersions.length})` : ""}
            </button>
          </div>

          {/* Older versions. The open one is already showing below, so this is
              only worth drawing when there is something else to switch to. */}
          {versions.length > 1 && (
            <div style={{ ...box, overflow: "hidden", marginBottom: 14 }}>
              {versions.map((v) => {
                const pill = pillOf(v.status);
                const open = openId === v.id;
                return (
                  <div key={v.id} style={{ borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexWrap: "wrap", background: open ? "var(--neutral-bg)" : undefined }}>
                    <b style={{ fontSize: 13 }}>v{v.version}</b>
                    <span style={{ background: pill.bg, color: pill.fg, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{pill.text}</span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(v.created_at)}</span>
                    <span style={{ flex: 1 }} />
                    <button type="button" onClick={() => setOpenId(v.id)} disabled={open}
                      style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: open ? "default" : "pointer", opacity: open ? 0.5 : 1 }}>
                      {open ? "Open" : "View"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {versions.length === 0 && (
            <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
              No {noun} yet for this client.{canCompose ? " Start one above." : ""}
            </div>
          )}

          {view === "chart" && plan && (
            <DietPlanBuilder pdf={pdf} whatsapp={whatsapp}
              key={plan.id}
              planId={plan.id}
              clientName={plan.client_name ?? clientName ?? "—"}
              status={plan.status}
              version={plan.version}
              canReview={canReview}
              dishes={dishes}
              medications={medsByClient[plan.client_id] ?? []}
              labs={labsByClient[plan.client_id] ?? []}
              // The newest assessment for this client, whatever its status —
              // a draft assessment is still the most recent thing anybody
              // learned about them.
              context={(() => {
                const a = allAssess
                  .filter((x) => x.client_id === plan.client_id)
                  .sort((x, y) => y.version - x.version)[0];
                return a
                  ? { region: a.assessment.region, shift_pattern: a.assessment.shift_pattern,
                      outside_meals: a.assessment.outside_meals }
                  : null;
              })()}
              // The chart before this one, whatever its status. A draft that
              // has not been published is still what the dietitian last
              // decided, and comparing against a published version two back
              // would report a jump nobody is making.
              previousTargetKcal={
                planVersions.find((p) => p.version < plan.version)?.targets.kcal ?? null
              }
              initial={{ targets: plan.targets, meta: plan.meta, meals: plan.meals, sharedAt: plan.sharedAt }}
              readOnly={!canCompose}
            />
          )}

          {view === "assessment" && assess && (
            <DietAssessmentBuilder pdf={pdf} whatsapp={whatsapp}
              key={assess.id}
              id={assess.id}
              clientId={assess.client_id}
              clientName={assess.client_name ?? clientName ?? "—"}
              status={assess.status}
              version={assess.version}
              canReview={canReview}
              sharedAt={assess.sharedAt}
              initial={{ ...assess.assessment, dob: assess.dob, gender: assess.gender, issued_on: assess.issued_on }}
              readOnly={!canCompose}
            />
          )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
