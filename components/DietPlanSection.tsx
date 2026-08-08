"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { createDietPlan } from "@/lib/actions";
import { DEFAULT_MEALS, type PlanMeal, type PlanTargets } from "@/lib/diet-plan";
import { todayISO } from "@/lib/today";
import DietPlanBuilder, { type PlanMeta } from "@/components/DietPlanBuilder";

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

const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const inpControl: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 34, fontSize: 13, background: "#fff", boxSizing: "border-box" };

const pillOf = (status: string) => {
  if (status === "published") return { bg: "var(--green-bg)", fg: "var(--green-text)", text: "Published" };
  if (status === "in_review") return { bg: "var(--blue-bg)", fg: "var(--blue-text)", text: "In review" };
  if (status === "archived") return { bg: "var(--neutral-bg)", fg: "var(--muted)", text: "Archived" };
  return { bg: "var(--amber-bg)", fg: "var(--amber-text)", text: "Draft" };
};

/**
 * Picks a client, lists their diet-plan versions, and opens DietPlanBuilder
 * for the chosen one — or starts a new draft. This IS the diet chart now:
 * the old flat chart builder was retired and this took its name. Sits on
 * the "charts" tab: same tab, a different (richer, structured) document.
 */
export default function DietPlanSection({
  plans, clients, canReview, canCompose, pdf, whatsapp }: {
  plans: DietPlanRow[];
  clients: { id: string; name: string }[];
  /** Can approve/send-back a plan awaiting sign-off. */
  canReview: boolean;
  pdf: { ready: boolean; missing: string[] };
  whatsapp?: { ready: boolean; missing: string[] };
  /** Can author plans at all (role gate + workspace read-only combined). */
  canCompose: boolean;
}) {
  // Deep-linked the same way as the diet chart / workout builders.
  const focusClient = useSearchParams().get("client") ?? "";
  const [selectedClient, setSelectedClient] = useState(focusClient);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  // Optimistic copy of a just-created plan — the real row only appears in
  // `plans` once the page's realtime subscription refetches.
  const [localNew, setLocalNew] = useState<DietPlanRow | null>(null);
  const [creating, startCreate] = useTransition();
  const [createErr, setCreateErr] = useState<string | null>(null);

  useEffect(() => {
    if (localNew && plans.some((p) => p.id === localNew.id)) setLocalNew(null);
  }, [plans, localNew]);

  const allPlans = localNew ? [localNew, ...plans.filter((p) => p.id !== localNew.id)] : plans;
  const plansForClient = allPlans.filter((p) => p.client_id === selectedClient).sort((a, b) => b.version - a.version);
  const selectedPlan = allPlans.find((p) => p.id === selectedPlanId) ?? null;

  const startNewPlan = () => {
    if (!selectedClient) { setCreateErr("Select a client first."); return; }
    setCreateErr(null);
    startCreate(async () => {
      const fd = new FormData();
      fd.set("client_id", selectedClient);
      const r = await createDietPlan(fd);
      if (r.error) { setCreateErr(r.error); return; }
      if (r.id) {
        const name = clients.find((c) => c.id === selectedClient)?.name ?? null;
        setLocalNew({
          id: r.id, client_id: selectedClient, client_name: name,
          version: plansForClient.length + 1, status: "draft", created_at: new Date().toISOString(),
          targets: { kcal: null, protein: null, carbohydrate: null, fats: null, fibre: null, water: null },
          meta: { allergies: null, notes: null, issued_on: todayISO() },
          meals: DEFAULT_MEALS.map((m) => ({ ...m, options: [] })),
          sharedAt: null,
        });
        setSelectedPlanId(r.id);
      }
    });
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        The structured, multi-page plan a client eats from — meal slots with time windows, numbered options, and targets. Separate from the diet chart above, which drives the day-2 explanation.
      </div>

      <div style={{ ...box, padding: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <select value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setSelectedPlanId(null); setLocalNew(null); setCreateErr(null); }} style={{ ...inpControl, minWidth: 220 }}>
          <option value="">Select client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClient && canCompose && (
          <button type="button" onClick={startNewPlan} disabled={creating}
            style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1 }}>
            {creating ? "Starting…" : "+ New plan"}
          </button>
        )}
        {createErr && <div style={{ fontSize: 12, color: "var(--red-text)" }}>{createErr}</div>}
      </div>

      {selectedClient && plansForClient.length > 0 && (
        <div style={{ ...box, overflow: "hidden", marginBottom: 14 }}>
          {plansForClient.map((p) => {
            const pill = pillOf(p.status);
            const open = selectedPlanId === p.id;
            return (
              <div key={p.id} style={{ borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexWrap: "wrap" }}>
                <b style={{ fontSize: 13 }}>v{p.version}</b>
                <span style={{ background: pill.bg, color: pill.fg, borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{pill.text}</span>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => setSelectedPlanId(open ? null : p.id)}
                  style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {open ? "Hide" : "Open"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedClient && plansForClient.length === 0 && (
        <div style={{ ...box, padding: "22px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13, marginBottom: 14 }}>
          No diet plans yet for this client.{canCompose ? " Start one above." : ""}
        </div>
      )}

      {selectedPlan && (
        <DietPlanBuilder pdf={pdf} whatsapp={whatsapp}
          key={selectedPlan.id}
          planId={selectedPlan.id}
          clientName={selectedPlan.client_name ?? "—"}
          status={selectedPlan.status}
          version={selectedPlan.version}
          canReview={canReview}
          initial={{ targets: selectedPlan.targets, meta: selectedPlan.meta, meals: selectedPlan.meals, sharedAt: selectedPlan.sharedAt }}
          readOnly={!canCompose}
        />
      )}
    </div>
  );
}
