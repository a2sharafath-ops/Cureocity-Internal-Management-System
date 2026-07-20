import WorkspaceTabs from "@/components/WorkspaceTabs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";
import { canConsult, canSee } from "@/lib/roles";
import { getPersona } from "@/lib/personas";
import ConsultationForm from "@/components/ConsultationForm";
import ConsultationItem, { type Consult } from "@/components/ConsultationItem";

import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

type Row = Consult & { clients: { name: string } | null };

export default async function ProPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/pro")) redirect("/dashboard");

  // If an admin has stepped into a professional persona, focus this workspace
  // on that discipline (Doctor / Coach / Psychologist).
  const { profession } = await getViewRole();
  const persona = getPersona(profession);
  const disciplineKind = persona?.kind && persona.kind !== "Trainer" && persona.kind !== "Diet" ? persona.kind : null;

  const supabase = createClient();
  const [{ data: consultData }, { data: clientData }] = await Promise.all([
    supabase.from("consultations").select("id, kind, status, summary, approved, shared, by_name, created_at, clients(name)").order("created_at", { ascending: false }).limit(100),
    // clients on care packages (Comprehensive or BluePrint) as consultation candidates
    supabase.from("clients").select("id, name, packages(is_facility)").order("name"),
  ]);

  const allConsults = (consultData ?? []) as unknown as Row[];
  const consults = disciplineKind ? allConsults.filter((c) => c.kind === disciplineKind) : allConsults;
  const clients = ((clientData ?? []) as unknown as { id: string; name: string; packages: { is_facility: boolean } | null }[])
    .filter((c) => c.packages && !c.packages.is_facility)
    .map((c) => ({ id: c.id, name: c.name }));

  const pending = consults.filter((c) => c.status !== "completed").length;
  const canEdit = canConsult(me.role);

  return (
    <div style={{ maxWidth: 900 }}>
      <RealtimeRefresh tables={["consultations"]} />
      <WorkspaceTabs active="pro" />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>{persona ? `${persona.label} Consultations` : "Consultations"}</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        {disciplineKind ? `${disciplineKind} consultations` : "Consultations"} · {consults.length} total · {pending} to complete
        {persona && <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>Persona view</span>}
      </p>

      {canEdit && <ConsultationForm clients={clients} />}

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", fontWeight: 700 }}>All consultations</div>
        {consults.length ? (
          consults.map((c) => (
            <ConsultationItem key={c.id} c={{ ...c, clientName: c.clients?.name }} />
          ))
        ) : (
          <div style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>
            No consultations yet — create one above.
          </div>
        )}
      </div>
    </div>
  );
}
