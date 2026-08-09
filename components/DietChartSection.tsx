"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createDietPlan, createDietAssessment } from "@/lib/actions";
import { DEFAULT_MEALS, type PlanMeal, type PlanTargets } from "@/lib/diet-plan";
import { type Assessment } from "@/lib/diet-assessment";
import { todayISO } from "@/lib/today";
import DietPlanBuilder, { type PlanMeta } from "@/components/DietPlanBuilder";
import DietAssessmentBuilder from "@/components/DietAssessmentBuilder";

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
const inpControl: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 34, fontSize: 13, background: "#fff", boxSizing: "border-box" };
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
  plans, assessments, clients, canReview, canCompose, pdf, whatsapp }: {
  plans: DietPlanRow[];
  assessments: DietAssessmentRow[];
  clients: { id: string; name: string }[];
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
    setErr(null);
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
          targets: { kcal: null, protein: null, carbohydrate: null, fats: null, fibre: null, water: null },
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

  const versions = view === "chart" ? planVersions : assessVersions;
  const openId = view === "chart" ? planId : assessId;
  const setOpenId = view === "chart" ? setPlanId : setAssessId;
  const noun = view === "chart" ? "chart" : "assessment";

  const tabBtn = (key: View): React.CSSProperties => ({
    border: "none", background: "none", padding: "9px 2px", marginRight: 20, fontSize: 13.5,
    fontWeight: view === key ? 700 : 500, color: view === key ? "var(--ink)" : "var(--muted)",
    borderBottom: view === key ? "2px solid var(--ink)" : "2px solid transparent",
    cursor: "pointer",
  });

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        One client, both halves of the write-up: the assessment records what was found, the chart is what they eat from.
      </div>

      {/* Client picker — chosen once, shared by both halves. */}
      <div style={{ ...box, padding: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select value={selectedClient} onChange={(e) => pickClient(e.target.value)} style={{ ...inpControl, minWidth: 220 }}>
          <option value="">Select client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClient && canCompose && (
          <button type="button" onClick={() => startNew(view)} disabled={creating}
            style={{ ...darkBtn, cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1 }}>
            {creating ? "Starting…" : view === "chart" ? "+ New chart" : "+ New assessment"}
          </button>
        )}
        {err && <div style={{ fontSize: 12, color: "var(--red-text)" }}>{err}</div>}
      </div>

      {selectedClient && (
        <>
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
        </>
      )}

      {!selectedClient && (
        <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
          Select a client to see their assessment and chart.
        </div>
      )}
    </div>
  );
}
