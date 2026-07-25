import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";
import { canConsult, canSee } from "@/lib/roles";
import { getPersona } from "@/lib/personas";
import ConsultationForm from "@/components/ConsultationForm";
import ConsultationItem, { type Consult } from "@/components/ConsultationItem";
import { startConsultFromAppointment } from "@/lib/actions";
import { todayISO } from "@/lib/today";

import RealtimeRefresh from "@/components/RealtimeRefresh";

export const dynamic = "force-dynamic";

type Row = Consult & { clients: { name: string } | null };
type ApptRow = { id: string; client_id: string | null; provider_id: string | null; date: string; hour: number; status: string; clients: { name: string } | null; staff: { name: string; role: string } | null };
const KIND_OF_ROLE: Record<string, string> = { Doctor: "Doctor", Dietitian: "Diet", "Fitness Trainer": "Trainer", "Health Coach": "Coach", Psychologist: "Psychologist" };
const hr12 = (h: number) => { const am = h < 12; const x = h % 12 === 0 ? 12 : h % 12; return `${x}${am ? "am" : "pm"}`; };

export default async function ProPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/pro")) redirect("/dashboard");

  // Folded into the workspace: anyone with a discipline workspace (clinicians +
  // admins) manages consultations there — the Summaries tab replicates this
  // page's start-consult form, list and approve/share, and the Appointments tab
  // covers "ready to start". Only Managers (who have no workspace) still land on
  // this standalone review list.
  if (canSee(me.role, "/workspace")) redirect("/workspace?tab=summaries");

  // If an admin has stepped into a professional persona, focus this workspace
  // on that discipline (Doctor / Coach / Psychologist).
  const { profession } = await getViewRole();
  const persona = getPersona(profession);
  const disciplineKind = persona?.kind && persona.kind !== "Trainer" && persona.kind !== "Diet" ? persona.kind : null;

  const supabase = createClient();
  const [{ data: consultData }, { data: clientData }, { data: apptData }] = await Promise.all([
    supabase.from("consultations").select("id, kind, status, summary, approved, shared, by_name, created_at, clients(name)").order("created_at", { ascending: false }).limit(100),
    // clients on care packages (Comprehensive or BluePrint) as consultation candidates
    supabase.from("clients").select("id, name, packages(is_facility)").order("name"),
    // booked slots ready to be started
    supabase.from("appointments").select("id, client_id, provider_id, date, hour, status, clients(name), staff(name, role)").eq("status", "scheduled").order("date").order("hour"),
  ]);

  const allConsults = (consultData ?? []) as unknown as Row[];
  const consults = disciplineKind ? allConsults.filter((c) => c.kind === disciplineKind) : allConsults;
  const clients = ((clientData ?? []) as unknown as { id: string; name: string; packages: { is_facility: boolean } | null }[])
    .filter((c) => c.packages && !c.packages.is_facility)
    .map((c) => ({ id: c.id, name: c.name }));

  // "Ready to start": booked slots this clinician can open. A real clinician
  // sees their own bookings (provider = their staff id); an admin stepped into a
  // persona sees that discipline's bookings.
  const appts = (apptData ?? []) as unknown as ApptRow[];
  const mine = appts.filter((a) => a.client_id && (
    me.staffId ? a.provider_id === me.staffId
      : disciplineKind ? KIND_OF_ROLE[a.staff?.role ?? ""] === disciplineKind
      : false
  ));

  const pending = consults.filter((c) => c.status !== "completed").length;
  const canEdit = canConsult(me.role);

  return (
    <div style={{ maxWidth: 900 }}>
      <RealtimeRefresh tables={["consultations", "appointments"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>{persona ? `${persona.label} Consultations` : "Consultations"}</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        {disciplineKind ? `${disciplineKind} consultations` : "Consultations"} · {consults.length} total · {pending} to complete
        {persona && <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600, marginLeft: 8 }}>Persona view</span>}
      </p>

      {/* Booked slots ready to start — one click opens the console for that client */}
      {canEdit && mine.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "12px 16px", fontWeight: 700 }}>▶ Ready to start · {mine.length}</div>
          {mine.map((a) => {
            const upcoming = a.date >= todayISO();
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{a.clients?.name ?? "—"}</span>
                <span style={{ color: "var(--muted)" }}>{new Date(a.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })} · {hr12(a.hour)}{a.staff?.name ? ` · ${a.staff.name}` : ""}</span>
                {!upcoming && <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>past</span>}
                <span style={{ flex: 1 }} />
                <form action={startConsultFromAppointment}>
                  <input type="hidden" name="appointment_id" value={a.id} />
                  <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Start →</button>
                </form>
              </div>
            );
          })}
        </div>
      )}

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
