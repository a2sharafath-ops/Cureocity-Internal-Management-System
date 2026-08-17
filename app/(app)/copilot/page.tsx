import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { staffCopilotAvailability, staffCopilotDefinition } from "@/lib/staff-copilot";
import SuperAdminCopilot, { type SuperAdminCopilotHistory } from "@/components/SuperAdminCopilot";
import StaffNavigationAssistant, { type StaffNavigationAssistantHistory } from "@/components/StaffNavigationAssistant";
import FrontDeskAssistant, { type FrontDeskAssistantHistory } from "@/components/FrontDeskAssistant";
import FitnessTrainerAssistant, { type FitnessTrainerAssistantHistory } from "@/components/FitnessTrainerAssistant";
import AdministratorAssistant, { type AdministratorAssistantHistory } from "@/components/AdministratorAssistant";
import ManagerAssistant, { type ManagerAssistantHistory } from "@/components/ManagerAssistant";
import DietitianAssistant, { type DietitianAssistantHistory } from "@/components/DietitianAssistant";
import PsychologistAssistant, { type PsychologistAssistantHistory } from "@/components/PsychologistAssistant";
import DoctorAssistant, { type DoctorAssistantHistory } from "@/components/DoctorAssistant";
import { createClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/runtime-errors";

export const dynamic = "force-dynamic";

const box: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow)",
};

export default async function StaffCopilotPage() {
  const me = await getProfile();
  if (!me) redirect("/login");
  if (me.role === "Client") redirect("/portal");

  const definition = staffCopilotDefinition(me.role);
  if (!definition) redirect("/dashboard");
  const availability = staffCopilotAvailability(me.role, process.env);
  let superAdminHistory: SuperAdminCopilotHistory[] = [];
  let superAdminHistoryError: string | null = null;
  let staffNavigationHistory: StaffNavigationAssistantHistory[] = [];
  let staffNavigationHistoryError: string | null = null;
  let frontDeskHistory: FrontDeskAssistantHistory[] = [];
  let frontDeskHistoryError: string | null = null;
  let fitnessTrainerHistory: FitnessTrainerAssistantHistory[] = [];
  let fitnessTrainerHistoryError: string | null = null;
  let administratorHistory: AdministratorAssistantHistory[] = [];
  let administratorHistoryError: string | null = null;
  let managerHistory: ManagerAssistantHistory[] = [];
  let managerHistoryError: string | null = null;
  let dietitianHistory: DietitianAssistantHistory[] = [];
  let dietitianHistoryError: string | null = null;
  let psychologistHistory: PsychologistAssistantHistory[] = [];
  let psychologistHistoryError: string | null = null;
  let doctorHistory: DoctorAssistantHistory[] = [];
  let doctorHistoryError: string | null = null;
  if (me.role === "Super Admin" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_copilot_drafts")
      .select("id, task_type, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Super Admin")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "super_admin_copilot", operation: "load_history" });
      superAdminHistoryError = "Draft history could not be loaded. No data was changed; verify migration 0183 before enabling the pilot.";
    } else {
      superAdminHistory = (data ?? []) as SuperAdminCopilotHistory[];
    }
  }
  if (me.role === "Staff" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Staff")
      .eq("task_key", "navigation_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "staff_navigation_assistant", operation: "load_history" });
      staffNavigationHistoryError = "Navigation history could not be loaded. No data was changed; verify migration 0186 before enabling this pilot.";
    } else {
      staffNavigationHistory = (data ?? []) as StaffNavigationAssistantHistory[];
    }
  }
  if (me.role === "Front Desk" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Front Desk")
      .eq("task_key", "operational_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "front_desk_assistant", operation: "load_history" });
      frontDeskHistoryError = "Front Desk checklist history could not be loaded. No data was changed; verify migrations 0186 and 0187 before enabling this pilot.";
    } else {
      frontDeskHistory = (data ?? []) as FrontDeskAssistantHistory[];
    }
  }
  if (me.role === "Fitness Trainer" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Fitness Trainer")
      .eq("task_key", "operational_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "fitness_trainer_assistant", operation: "load_history" });
      fitnessTrainerHistoryError = "Fitness Trainer checklist history could not be loaded. No data was changed; verify migrations 0186 and 0188 before enabling this pilot.";
    } else {
      fitnessTrainerHistory = (data ?? []) as FitnessTrainerAssistantHistory[];
    }
  }
  if (me.role === "Administrator" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Administrator")
      .eq("task_key", "governance_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "administrator_assistant", operation: "load_history" });
      administratorHistoryError = "Administrator checklist history could not be loaded. No data was changed; verify migrations 0186 and 0189 before enabling this pilot.";
    } else {
      administratorHistory = (data ?? []) as AdministratorAssistantHistory[];
    }
  }
  if (me.role === "Manager" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Manager")
      .eq("task_key", "operations_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "manager_assistant", operation: "load_history" });
      managerHistoryError = "Manager checklist history could not be loaded. No data was changed; verify migrations 0186 and 0190 before enabling this pilot.";
    } else {
      managerHistory = (data ?? []) as ManagerAssistantHistory[];
    }
  }
  if (me.role === "Dietitian" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Dietitian")
      .eq("task_key", "review_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "dietitian_assistant", operation: "load_history" });
      dietitianHistoryError = "Dietitian checklist history could not be loaded. No data was changed; verify migrations 0186 and 0191 before enabling this pilot.";
    } else {
      dietitianHistory = (data ?? []) as DietitianAssistantHistory[];
    }
  }
  if (me.role === "Psychologist" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Psychologist")
      .eq("task_key", "workflow_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "psychologist_assistant", operation: "load_history" });
      psychologistHistoryError = "Psychologist checklist history could not be loaded. No data was changed; verify migrations 0186 and 0192 before enabling this pilot.";
    } else {
      psychologistHistory = (data ?? []) as PsychologistAssistantHistory[];
    }
  }
  if (me.role === "Doctor" && availability.enabled) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("staff_assistant_drafts")
      .select("id, title, draft_text, accepted_text, status, created_at, accepted_at")
      .eq("role_name", "Doctor")
      .eq("task_key", "workflow_checklist")
      .eq("created_by", me.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      logServerError(error, { source: "doctor_assistant", operation: "load_history" });
      doctorHistoryError = "Doctor checklist history could not be loaded. No data was changed; verify migrations 0186 and 0193 before enabling this pilot.";
    } else {
      doctorHistory = (data ?? []) as DoctorAssistantHistory[];
    }
  }

  return (
    <div style={{ maxWidth: 940, display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, margin: "0 0 3px" }}>Cureocity Assistant</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Role-aware, draft-only assistance for {me.role}. Cureocity Assistant never completes work or contacts a client by itself.
        </p>
      </div>

      <div style={{ ...box, padding: 18, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>{definition.title}</h2>
          <span style={{ borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 750, background: availability.enabled ? "var(--green-bg)" : "var(--amber-bg)", color: availability.enabled ? "var(--green-text)" : "var(--amber-text)" }}>
            {availability.enabled ? "Available" : definition.functional ? "Configured pilot — currently off" : "Scope not approved"}
          </span>
        </div>

        {definition.allowedTasks.length > 0 ? (
          <div>
            <b style={{ fontSize: 12.5 }}>Approved draft tasks</b>
            <ul style={{ margin: "7px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: 12.5, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", columnGap: 24 }}>
              {definition.allowedTasks.map((task) => <li key={task} style={{ marginBottom: 5 }}>{task}</li>)}
            </ul>
          </div>
        ) : (
          <div style={{ color: "var(--amber-text)", background: "var(--amber-bg)", borderRadius: 10, padding: "11px 13px", fontSize: 12.5 }}>
            No AI task is enabled for {me.role}. A feature flag cannot activate this page until the allowed tasks, source records, scope limits and human reviewer are explicitly approved and implemented server-side.
          </div>
        )}

        {availability.reasons.length > 0 && definition.functional && (
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--muted)", fontSize: 12.5 }}>
            {availability.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        )}

        {definition.existingHref && (
          <div>
            <Link href={definition.existingHref} style={{ display: "inline-block", borderRadius: 9, padding: "8px 13px", background: "var(--ink)", color: "#fff", textDecoration: "none", fontSize: 12.5, fontWeight: 700 }}>
              Open guarded Health Coach assistant
            </Link>
          </div>
        )}
      </div>

      {me.role === "Super Admin" && (
        <SuperAdminCopilot
          history={superAdminHistory}
          enabled={availability.enabled}
          historyError={superAdminHistoryError}
        />
      )}

      {me.role === "Staff" && (
        <StaffNavigationAssistant
          history={staffNavigationHistory}
          enabled={availability.enabled}
          historyError={staffNavigationHistoryError}
        />
      )}

      {me.role === "Front Desk" && (
        <FrontDeskAssistant
          history={frontDeskHistory}
          enabled={availability.enabled}
          historyError={frontDeskHistoryError}
        />
      )}

      {me.role === "Fitness Trainer" && (
        <FitnessTrainerAssistant
          history={fitnessTrainerHistory}
          enabled={availability.enabled}
          historyError={fitnessTrainerHistoryError}
        />
      )}

      {me.role === "Administrator" && (
        <AdministratorAssistant
          history={administratorHistory}
          enabled={availability.enabled}
          historyError={administratorHistoryError}
        />
      )}

      {me.role === "Manager" && (
        <ManagerAssistant history={managerHistory} enabled={availability.enabled} historyError={managerHistoryError} />
      )}

      {me.role === "Dietitian" && (
        <DietitianAssistant history={dietitianHistory} enabled={availability.enabled} historyError={dietitianHistoryError} />
      )}

      {me.role === "Psychologist" && (
        <PsychologistAssistant history={psychologistHistory} enabled={availability.enabled} historyError={psychologistHistoryError} />
      )}

      {me.role === "Doctor" && (
        <DoctorAssistant history={doctorHistory} enabled={availability.enabled} historyError={doctorHistoryError} />
      )}

      <div style={{ ...box, padding: 18 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 9px" }}>Controls that apply to every role</h2>
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55 }}>
          <li>Outputs must remain clearly labelled drafts and require the staff member to review every word.</li>
          <li>No draft may send a message, update a record, create a referral, approve a document or close a safety item automatically.</li>
          <li>Each role needs an explicit allowlist of tasks and data sources; ordinary feature flags cannot grant new clinical permissions.</li>
          <li>Clients cannot access this staff route. Every task stays off without its own role flag; tasks that use external AI also require a configured server connection.</li>
          <li>Generation, acceptance and discard events must remain auditable before any new role becomes functional.</li>
        </ul>
      </div>

      {!definition.functional && (
        <div style={{ ...box, padding: 18 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Decisions still required for {me.role}</h2>
          <ol style={{ margin: 0, paddingLeft: 20, color: "var(--muted)", fontSize: 12.5, lineHeight: 1.55 }}>
            <li>Which tasks may be drafted, and which actions are always prohibited?</li>
            <li>Which existing records may the Copilot read for each task?</li>
            <li>Which safety or escalation conditions must stop generation?</li>
            <li>Who reviews the draft, and where accepted text may be copied manually?</li>
          </ol>
        </div>
      )}
    </div>
  );
}
