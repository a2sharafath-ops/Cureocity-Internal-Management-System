"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createDietAssessment } from "@/lib/actions";
import { type Assessment } from "@/lib/diet-assessment";
import { todayISO } from "@/lib/today";
import DietAssessmentBuilder from "@/components/DietAssessmentBuilder";

export type DietAssessmentRow = {
  id: string;
  client_id: string;
  client_name: string | null;
  version: number;
  status: string;
  created_at: string;
  issued_on: string | null;
  sharedAt: string | null;
  /** From the client record — not versioned, just carried along for the BMR estimate hint. */
  dob: string | null;
  gender: string | null;
  assessment: Assessment;
};

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const inpControl: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 34, fontSize: 13, background: "#fff", boxSizing: "border-box" };

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

/**
 * Picks a client, lists their assessment-summary versions, and opens
 * DietAssessmentBuilder for the chosen one — or drafts a new one. Mirrors
 * DietPlanSection exactly; sits in the same "charts" tab as the diet plan,
 * one row below it.
 */
export default function DietAssessmentSection({
  assessments, clients, canReview, canCompose, pdf, whatsapp }: {
  assessments: DietAssessmentRow[];
  clients: { id: string; name: string }[];
  /** Can approve/send-back an assessment awaiting sign-off. */
  canReview: boolean;
  pdf: { ready: boolean; missing: string[] };
  whatsapp?: { ready: boolean; missing: string[] };
  /** Can author assessments at all (role gate + workspace read-only combined). */
  canCompose: boolean;
}) {
  const focusClient = useSearchParams().get("client") ?? "";
  const [selectedClient, setSelectedClient] = useState(focusClient);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Optimistic copy of a just-drafted assessment — the real row (with its
  // server-drafted fields) only appears once the workspace realtime
  // subscription refetches diet_assessments.
  const [localNew, setLocalNew] = useState<DietAssessmentRow | null>(null);
  const [creating, startCreate] = useTransition();
  const [createErr, setCreateErr] = useState<string | null>(null);

  useEffect(() => {
    if (localNew && assessments.some((a) => a.id === localNew.id)) setLocalNew(null);
  }, [assessments, localNew]);

  const all = localNew ? [localNew, ...assessments.filter((a) => a.id !== localNew.id)] : assessments;
  const forClient = all.filter((a) => a.client_id === selectedClient).sort((a, b) => b.version - a.version);
  const selected = all.find((a) => a.id === selectedId) ?? null;

  const startNew = () => {
    if (!selectedClient) { setCreateErr("Select a client first."); return; }
    setCreateErr(null);
    startCreate(async () => {
      const fd = new FormData();
      fd.set("client_id", selectedClient);
      const r = await createDietAssessment(fd);
      if (r.error) { setCreateErr(r.error); return; }
      if (r.id) {
        const name = clients.find((c) => c.id === selectedClient)?.name ?? null;
        setLocalNew({
          id: r.id, client_id: selectedClient, client_name: name,
          version: forClient.length + 1, status: "draft", created_at: new Date().toISOString(),
          issued_on: todayISO(), sharedAt: null, dob: null, gender: null,
          assessment: blankAssessment(),
        });
        setSelectedId(r.id);
      }
    });
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        The companion document to the diet plan — what was found, where the plan came from. Drafted from the client record, the InBody and the Diet questionnaire; correct rather than retype.
      </div>

      <div style={{ ...box, padding: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setSelectedId(null); setLocalNew(null); setCreateErr(null); }} style={{ ...inpControl, minWidth: 220 }}>
          <option value="">Select client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClient && canCompose && (
          <button type="button" onClick={startNew} disabled={creating}
            style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1 }}>
            {creating ? "Starting…" : "+ New assessment"}
          </button>
        )}
        {createErr && <div style={{ fontSize: 12, color: "var(--red-text)" }}>{createErr}</div>}
      </div>

      {selectedClient && forClient.length > 0 && (
        <div style={{ ...box, overflow: "hidden", marginBottom: 14 }}>
          {forClient.map((a) => {
            const pill = pillOf(a.status);
            const open = selectedId === a.id;
            return (
              <div key={a.id} style={{ borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexWrap: "wrap" }}>
                <b style={{ fontSize: 13 }}>v{a.version}</b>
                <span style={{ background: pill.bg, color: pill.fg, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{pill.text}</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => setSelectedId(open ? null : a.id)}
                  style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {open ? "Hide" : "Open"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedClient && forClient.length === 0 && (
        <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
          No assessment summaries yet for this client.{canCompose ? " Start one above." : ""}
        </div>
      )}

      {selected && (
        <DietAssessmentBuilder pdf={pdf} whatsapp={whatsapp}
          key={selected.id}
          id={selected.id}
          clientId={selected.client_id}
          clientName={selected.client_name ?? "—"}
          status={selected.status}
          version={selected.version}
          canReview={canReview}
          sharedAt={selected.sharedAt}
          initial={{ ...selected.assessment, dob: selected.dob, gender: selected.gender, issued_on: selected.issued_on }}
          readOnly={!canCompose}
        />
      )}
    </div>
  );
}
