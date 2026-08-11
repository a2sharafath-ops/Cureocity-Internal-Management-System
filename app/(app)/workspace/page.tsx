import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";
import { canSee, isClinician, canReviewDietChart, canDeliverDoc } from "@/lib/roles";
import { getPersona } from "@/lib/personas";
import { todayISO, todayLabel } from "@/lib/today";
import { loadClientStatuses, clientStatus } from "@/lib/client-status";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import SegTabs from "@/components/SegTabs";
import MetricCard from "@/components/MetricCard";
import WorkspaceClients, { type WsClientRow } from "@/components/WorkspaceClients";
import MealMonitoringSection from "@/components/MealMonitoringSection";
import BlueprintSection from "@/components/BlueprintSection";
import WhiteboardSection from "@/components/WhiteboardSection";
import ExerciseLibrarySection from "@/components/ExerciseLibrarySection";
import ConcernsPanel, { type ConcernRow } from "@/components/ConcernsPanel";
import MdtBoard, { type MdtRow } from "@/components/MdtBoard";
import ResourceLibrary, { type ResourceRow } from "@/components/ResourceLibrary";
import DietChartSection, { type DietPlanRow, type DietAssessmentRow } from "@/components/DietChartSection";
import ApprovalsQueue, { type ApprovalRow } from "@/components/ApprovalsQueue";
import { pdfReadiness } from "@/lib/pdf";
import { watiReadiness } from "@/lib/wati";
import { type PlanMeal, type PlanOption, type PlanComponent, type DishOption } from "@/lib/diet-plan";
import { pricedDishes, fetchAllRows } from "@/lib/dish-pricing";
import WorkoutPlanner, { type WorkoutPlanRow } from "@/components/WorkoutPlanner";
import { loadCatOf } from "@/lib/appt-match";

import RecipeLibrary, { type RecipeRow } from "@/components/RecipeLibrary";
import DishLibrary, { type DishRow } from "@/components/DishLibrary";
import { MICRO_KEYS, type Food, type Measure, type MicroFood } from "@/lib/nutrition";
import SummariesPanel, { type ConsultSummary, type ConsolidatedRow } from "@/components/SummariesPanel";
import { deletable } from "@/lib/consult-lifecycle";
import AppointmentsBoard, { type ApptRow } from "@/components/AppointmentsBoard";
import TrialOutcomeActions from "@/components/TrialOutcomeActions";
import ClientStatusBadge from "@/components/ClientStatusBadge";
import SubmitButton from "@/components/SubmitButton";
import MarkConsultDone from "@/components/MarkConsultDone";
import { startConsultFromAppointment, markSessionComplete } from "@/lib/actions";
import FollowupsBoard, { type FuRow } from "@/components/FollowupsBoard";
import CoachMarkersSection from "@/components/CoachMarkersSection";
import AttentionPanel, { type Flag } from "@/components/AttentionPanel";
import { careWorkFlags } from "@/lib/care-attention";
import { withChaseHistory } from "@/lib/chase-log";
import { disciplineLabel } from "@/lib/disciplines";
import { canWriteNutrition } from "@/lib/discipline";
import {
  WS_ROLES, WS_TABS, wsRole, roleFromPersonaKind, roleFromStaffRole, scopeClients,
  visibleWorkspaces, canEditWorkspace, type WsClient, type WsRoleKey,
} from "@/lib/workspaces";

export const dynamic = "force-dynamic";

type ClientRow = WsClient & { used: number | null; packages: { name: string; sessions: number } | null };

export default async function WorkspacePage(
  props: { searchParams: Promise<{ role?: string; tab?: string; d?: string }> }
) {
  const searchParams = await props.searchParams;
  const me = await getProfile();
  if (!me || !canSee(me.role, "/workspace")) redirect("/dashboard");

  // Resolve active role: ?role → own discipline → persona → default —
  // constrained to the disciplines this login role is allowed to view.
  const { profession } = await getViewRole();
  const persona = getPersona(profession);
  // While an admin previews a discipline persona, the workspace behaves exactly
  // as that clinician's would — one workspace, no switcher — so the preview is
  // faithful. Real write permissions still follow the actual login role.
  const visibilityRole = persona?.key ?? me.role;
  const allowed = visibleWorkspaces(visibilityRole);
  let roleKey: WsRoleKey =
    (WS_ROLES.find((r) => r.key === searchParams.role)?.key)
    ?? roleFromStaffRole(visibilityRole)
    ?? roleFromPersonaKind(persona?.kind)
    ?? "doctor";
  if (!allowed.includes(roleKey)) roleKey = roleFromStaffRole(visibilityRole) ?? allowed[0] ?? "doctor";
  const role = wsRole(roleKey);

  // Viewing another discipline's workspace (clinician, not your own) is read-only.
  const readOnly = !canEditWorkspace(me.role, roleKey);
  const roQuery = readOnly ? "?ro=1" : "";

  // Read-only cross-discipline view is limited to the client-detail tabs.
  const RO_TABS = ["dash", "clients"];
  const baseTabs = readOnly ? WS_TABS[roleKey].filter((t) => RO_TABS.includes(t.key)) : WS_TABS[roleKey];

  // The reviewer's queue needs a home of its own. Sign-off lives in sections of
  // the DIETITIAN's "Diet charts" tab, which is the right place for the person
  // who wrote the document and the wrong one for the person approving it — the
  // Medical Director had to know to switch discipline, open a tab named after
  // someone else's job, and scroll. So they get an Approvals tab in whichever
  // workspace they are already in.
  const canReview = canReviewDietChart(me.role);
  const tabs = canReview
    ? [...baseTabs, { key: "approvals", label: "Approvals", live: true }]
    : baseTabs;

  // Resolve active tab. An unknown ?tab= falls back to Today rather than
  // rendering nothing — which is also why a tab branch with no entry here is
  // unreachable even by typing the URL.
  const tab = tabs.find((t) => t.key === searchParams.tab) ? searchParams.tab! : "dash";

  const supabase = await createClient();
  const today = todayISO();
  const isTrainer = roleKey === "trainer";
  // "Today" is this clinician's own day, not the whole clinic's. A real
  // clinician login scopes to their own bookings (provider = their staff id);
  // an admin previewing a persona scopes to the discipline instead (there's no
  // single staff), which still hides other disciplines' appointments.
  const WS_ROLE_TO_KIND: Record<string, string> = { Doctor: "Doctor", Dietitian: "Diet", "Fitness Trainer": "Trainer", "Health Coach": "Coach", Psychologist: "Psychologist" };
  const scopeToStaff = Boolean(me.staffId) && isClinician(me.role);

  const [{ data: clientData }, { data: enrollData }, { count: pendingSummaries }, todayRes, { data: concernData }, { data: mdtData }] = await Promise.all([
    supabase.from("clients").select("id, name, code, package_id, pro_id, conditions, goals, used, packages(name, sessions)").order("name"),
    supabase.from("enrollments").select("client_id"),
    supabase.from("consultations").select("id", { count: "exact", head: true }).eq("kind", role.kind).eq("approved", false),
    // Everyone's today = their appointments (consultations / assessments). The
    // trainer additionally gets their strength sessions, fetched + merged below.
    supabase.from("appointments").select("id, hour, type, title, status, provider_id, client_id, clients(name), staff(role)").eq("date", today).eq("status", "scheduled").order("hour"),
    supabase.from("concerns").select("id, client_id, category, body, raised_by, status, created_at, clients(name)").in("role", [roleKey, "general"]).order("created_at", { ascending: false }),
    supabase.from("mdt_notes").select("id, client_id, author, body, escalated, to_role, status, created_at, clients(name)").order("created_at", { ascending: false }).limit(60),
  ]);

  const allClients = (clientData ?? []) as unknown as ClientRow[];
  const trainingIds = new Set(((enrollData ?? []) as { client_id: string }[]).map((e) => e.client_id));
  // Clients whose care team includes this workspace's discipline — the source of
  // truth, so PT/Comprehensive clients show for their assigned trainer/coach.
  const wsDiscKey = ({ doctor: "doctor", diet: "dietitian", trainer: "trainer", coach: "coach", psych: "psychologist" } as Record<string, string>)[roleKey];
  const { data: asgData } = await supabase.from("client_assignments").select("client_id, staff_id").eq("discipline", wsDiscKey);
  // A real clinician login sees only THEIR assigned clients; an admin previewing
  // a persona (no staffId) sees the whole discipline. Clients assigned to a
  // *different* clinician of this discipline are tracked separately so the
  // heuristic fallback in scopeClients never leaks them onto this roster (e.g. a
  // newly added coach must not inherit another coach's clients).
  const assignedIds = new Set<string>();
  const otherClinicianIds = new Set<string>();
  for (const a of (asgData ?? []) as { client_id: string; staff_id: string | null }[]) {
    if (!scopeToStaff || a.staff_id === me.staffId) assignedIds.add(a.client_id);
    else if (a.staff_id) otherClinicianIds.add(a.client_id);
  }
  // Also treat a booked appointment as ownership: a non-cancelled appointment
  // whose provider is this clinician (or this discipline, in persona preview)
  // puts the client on the roster before the care-team row is written.
  const { data: apptOwn } = await supabase
    .from("appointments").select("client_id, provider_id, staff:provider_id(role)").neq("status", "cancelled").not("client_id", "is", null);
  for (const a of (apptOwn ?? []) as unknown as { client_id: string | null; provider_id: string | null; staff: { role: string } | null }[]) {
    if (!a.client_id || WS_ROLE_TO_KIND[a.staff?.role ?? ""] !== role.kind) continue;
    if (!scopeToStaff || a.provider_id === me.staffId) assignedIds.add(a.client_id);
    else if (a.provider_id) otherClinicianIds.add(a.client_id);
  }
  const scoped = scopeClients(roleKey, allClients, trainingIds, assignedIds, otherClinicianIds);

  // "Needs your attention" for the clinician — their own outstanding care-work
  // deliverables (diet chart, workout plan, blood-report chasing, etc.),
  // filtered from the clinic-wide queue to items this clinician owns. Buttons
  // are stripped to a plain "View" (a clinician doesn't nudge themselves).
  let myAttention: Flag[] = [];
  if (me.staffId && isClinician(me.role)) {
    const scopedIdSet = new Set(scoped.map((c) => c.id));
    const allFlags = await careWorkFlags(today);
    // Two ways a flag is yours, and both are needed.
    //
    //   • by name — the queue resolved YOU as the owner (`nudge`);
    //   • by role — it is owed by your role and nobody individual could be
    //     resolved (`chaseRole`).
    //
    // Only the first was checked, which was fine while every role-wide flag
    // belonged to Front Desk — they read them on the ops dashboard. Now that
    // booking is the Health Coach's, all of it arrives as `chaseRole`, and a
    // coach is redirected away from that dashboard: they would have been made
    // accountable for work their own screen never showed them.
    const mine = (f: Flag) => {
      if (f.nudge) return f.nudge.staffId === me.staffId && (!f.nudge.clientId || scopedIdSet.has(f.nudge.clientId));
      if (f.chaseRole) return f.chaseRole.roles.includes(me.role) && (!f.chaseRole.clientId || scopedIdSet.has(f.chaseRole.clientId));
      return false;
    };
    // Buttons stripped to a plain "View" — you don't chase yourself — but the
    // chase note stays: knowing you were chased twice about this is the point.
    const withNote = await withChaseHistory(allFlags.filter(mine));
    myAttention = withNote.map((f) => ({
      sev: f.sev, title: f.title, detail: f.detail, href: f.href,
      cta: f.cta ?? "View", dueLabel: f.dueLabel, overdue: f.overdue, chaseNote: f.chaseNote,
    }));
  }

  // The reviewer's own queue. The Medical Director signs off every diet chart,
  // plan and assessment, but they land on the DOCTOR workspace (their own
  // caseload) while the approval screen lives in the DIET one — so without this
  // the only route to it is a notification, and a missed notification means a
  // client waits on a document nobody can see is waiting. Shown on whichever
  // discipline they happen to be looking at, for that reason.
  if (canReviewDietChart(me.role)) {
    const [{ data: qPlans }, { data: qAssess }] = await Promise.all([
      supabase.from("diet_plans").select("id, clients(name)").eq("status", "in_review"),
      supabase.from("diet_assessments").select("id, clients(name)").eq("status", "in_review"),
    ]);
    // All three documents are sections of the one "Diet charts" tab.
    const queue: [string, { clients: { name: string } | null }[]][] = [
      ["Diet plan", (qPlans ?? []) as never],
      ["Assessment summary", (qAssess ?? []) as never],
    ];
    for (const [label, rows] of queue) {
      for (const r of rows) {
        myAttention.unshift({
          sev: "high",
          title: `${r.clients?.name ?? "A client"} — ${label.toLowerCase()} awaiting your approval`,
          detail: "Submitted by the dietitian · nothing reaches the client until you publish it",
          // Their own tab, not the dietitian's workspace — following this used
          // to strand them in another discipline with no way back.
          href: "/workspace?tab=approvals", cta: "Review",
        });
      }
    }
  }

  // Health Coach owns scheduling the Day-2 diet chart explanation. Surface it
  // straight from this coach's scoped clients (any due/overdue Day-2 explanation
  // follow-up still open) so it always reaches the assigned coach — independent
  // of care-team owner resolution.
  if (roleKey === "coach" && scoped.length) {
    const scopedIds = scoped.map((c) => c.id);
    const [{ data: deRows }, { data: chartRows }] = await Promise.all([
      supabase.from("followups").select("client_id, label, day, due_date, stage, clients(name)")
        .in("client_id", scopedIds).eq("day", 2).lte("due_date", today),
      supabase.from("diet_plans").select("client_id").in("client_id", scopedIds),
    ]);
    // The explanation is only actionable once the dietitian's chart draft exists
    // — you can't explain a chart that hasn't been written.
    const hasChart = new Set(((chartRows ?? []) as { client_id: string }[]).map((r) => r.client_id));
    const FU_CLOSED = new Set(["BOOKED", "COMPLETED", "NO_CONSULT"]);
    const fmtD = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
    for (const f of (deRows ?? []) as unknown as { client_id: string; label: string; due_date: string; stage: string; clients: { name: string } | null }[]) {
      if (!/explanation/i.test(f.label) || FU_CLOSED.has(f.stage) || !hasChart.has(f.client_id)) continue;
      const overdue = f.due_date < today;
      myAttention.unshift({
        sev: overdue ? "high" : "med",
        title: `${f.clients?.name ?? "Client"} — diet chart explanation due`,
        detail: `Day 2 · ${overdue ? `was due ${fmtD(f.due_date)}` : "due today"} — schedule & deliver`,
        // Open the Appointment Calendar prefilled to book the Day-2 diet chart
        // explanation: it's a Diet Consultation delivered by the dietitian (the
        // coach only owns scheduling it), so filter to Dietitian and set the
        // correct type — not the coach as provider.
        href: `/appointments?client=${f.client_id}&disc=Dietitian&type=${encodeURIComponent("Diet Chart Explanation")}`,
        cta: "Schedule",
      });
    }
  }

  // The coach also owns the ongoing follow-up calls (Day-10 diet follow-up,
  // Day-21 review, Day-28 doctor follow-up, renewals, etc.). A due or overdue one
  // is genuine attention — surface it so it dents the score instead of sitting
  // silently in the Follow-ups tab. Same scope as the Follow-ups board (pending,
  // this coach's clients). The Day-2 diet chart explanation is handled above (it
  // has its own chart-drafted gate), so skip it here to avoid double-counting.
  if (roleKey === "coach" && scoped.length) {
    const scopedIds = scoped.map((c) => c.id);
    const fmtFu = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
    const { data: dueFu } = await supabase.from("followups")
      .select("client_id, label, day, due_date, status, clients(name)")
      .in("client_id", scopedIds).eq("status", "pending").lte("due_date", today).order("due_date");
    for (const f of (dueFu ?? []) as unknown as { client_id: string; label: string; day: number | null; due_date: string; status: string; clients: { name: string } | null }[]) {
      if (f.day === 2 && /explanation/i.test(f.label)) continue; // handled above
      const overdue = f.due_date < today;
      myAttention.push({
        sev: overdue ? "high" : "med",
        title: `${f.clients?.name ?? "Client"} — ${f.label.toLowerCase()}`,
        detail: overdue ? `was due ${fmtFu(f.due_date)}` : "due today",
        href: `/workspace?role=coach&tab=followups`,
        cta: "Follow-ups",
      });
    }
  }

  const rosterRows: WsClientRow[] = scoped.map((c) => ({
    id: c.id, name: c.name, code: c.code,
    pkg: (c as ClientRow).packages?.name ?? c.package_id,
    conditions: c.conditions, goals: c.goals ?? [],
  }));
  // Role-aware status for this clinician's own discipline, shown on every roster row.
  const wsDisc = ({ doctor: "doctor", diet: "dietitian", trainer: "trainer", coach: "coach", psych: "psychologist" } as Record<string, string>)[roleKey] ?? null;
  const wsStatuses = await loadClientStatuses(supabase, scoped.map((c) => c.id), today);
  for (const r of rosterRows) r.careStatus = clientStatus(wsStatuses.get(r.id), wsDisc);

  // Today's appointments, scoped to this clinician: their own bookings (real
  // login) or their discipline (admin persona preview) — so a trainer sees the
  // fitness assessments they run, a doctor their consults, etc.
  type TodayItem = { id: string; hour: number | null; client_id: string | null; client_name: string | null; type?: string | null; title?: string | null; status: string; provider_id: string | null; isSession: boolean };
  const apptRaw = (todayRes.data ?? []) as unknown as { id: string; hour: number | null; type?: string; title?: string | null; status?: string; provider_id?: string | null; client_id?: string | null; clients: { name: string } | null; staff?: { role: string } | null }[];
  const apptToday: TodayItem[] = apptRaw
    .filter((a) => scopeToStaff ? a.provider_id === me.staffId : WS_ROLE_TO_KIND[a.staff?.role ?? ""] === role.kind)
    .map((a) => ({ id: a.id, hour: a.hour, client_id: a.client_id ?? null, client_name: a.clients?.name ?? null, type: a.type ?? null, title: a.title ?? null, status: a.status ?? "scheduled", provider_id: a.provider_id ?? null, isSession: false }));

  // Trainer also has strength sessions (workouts) today.
  let sessToday: TodayItem[] = [];
  if (isTrainer) {
    // Include completed sessions too — a done session must still show (with a ✓),
    // otherwise the trainer can't tell whether it happened; it just disappears.
    const { data: sd } = await supabase.from("sessions").select("id, hour, status, trainer_id, client_id, clients(name)").eq("date", today).neq("status", "cancelled").order("hour");
    sessToday = ((sd ?? []) as unknown as { id: string; hour: number | null; status: string; trainer_id: string | null; client_id: string | null; clients: { name: string } | null }[])
      .filter((s) => scopeToStaff ? s.trainer_id === me.staffId : true)
      .map((s) => ({ id: s.id, hour: s.hour, client_id: s.client_id, client_name: s.clients?.name ?? null, status: s.status, provider_id: s.trainer_id, isSession: true }));
  }
  const todayList: TodayItem[] = [...sessToday, ...apptToday].sort((x, y) => (x.hour ?? 0) - (y.hour ?? 0));

  // Overdue: scheduled appointments whose date has passed but were never marked
  // completed / cancelled. They fall off "Today" (which is strictly date = today),
  // so a missed consult would otherwise vanish from the clinician's view. Same
  // scoping as Today — own bookings for a real login, the discipline in preview.
  let overdueAppts: (TodayItem & { date: string })[] = [];
  if (tab === "dash") {
    const { data: odRaw } = await supabase
      .from("appointments")
      .select("id, hour, date, type, title, status, provider_id, client_id, clients(name), staff(role)")
      .eq("status", "scheduled").lt("date", today).order("date", { ascending: true }).limit(50);
    overdueAppts = ((odRaw ?? []) as unknown as { id: string; hour: number | null; date: string; type?: string; title?: string | null; status?: string; provider_id?: string | null; client_id?: string | null; clients: { name: string } | null; staff?: { role: string } | null }[])
      .filter((a) => scopeToStaff ? a.provider_id === me.staffId : WS_ROLE_TO_KIND[a.staff?.role ?? ""] === role.kind)
      .map((a) => ({ id: a.id, hour: a.hour, client_id: a.client_id ?? null, client_name: a.clients?.name ?? null, type: a.type ?? null, title: a.title ?? null, status: a.status ?? "scheduled", provider_id: a.provider_id ?? null, isSession: false, date: a.date }));

    // An overdue appointment is a genuine "needs attention" item — otherwise the
    // health score reads 100 / "nothing needs attention" while a consult is
    // sitting unconducted. Feed each into the clinician's attention flags (high
    // severity) so the score is honest. The dedicated Overdue card below still
    // carries the one-click Start; this only makes the summary count truthful.
    if (me.staffId && isClinician(me.role)) {
      const fmtOd = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
      for (const a of overdueAppts) {
        myAttention.unshift({
          sev: "high",
          title: `${a.client_name ?? "Client"} — ${(a.type || "consultation").toLowerCase()} overdue`,
          detail: `Was due ${fmtOd(a.date)} · conduct or reschedule`,
          href: a.client_id ? `/clients/${a.client_id}${roQuery}` : "/appointments",
          cta: "Open",
          // "Open" should drop the clinician straight INTO the consultation, not
          // just onto the client page. When they can act (not a read-only cross-
          // discipline view) and it's a real client booking, wire it to the same
          // start-consult action the Start button uses — it creates-or-resumes the
          // consult and redirects into /console/{id}. The href above stays as the
          // fallback for read-only viewers.
          startConsultAppointmentId: !readOnly && a.client_id ? a.id : undefined,
        });
      }
    }
  }

  // Experience (pre-sale trial) bookings assigned to *me*, matched by provider —
  // NOT by client roster. A free assessment/training for a lead has client_id
  // null, so every roster-scoped query above filters it out. Matching on the
  // staff id is how a trial reaches whoever is actually rostered to run it.
  type ExpItem = { id: string; kind: "assessment" | "training"; lead_id: string | null; lead_name: string | null; date: string | null; hour: number | null; status: string };
  let myExperience: ExpItem[] = [];
  if (me.staffId && !readOnly) {
    const [{ data: ea }, { data: es }] = await Promise.all([
      supabase.from("appointments").select("id, lead_id, date, hour, status").eq("provider_id", me.staffId).eq("is_experience", true).neq("status", "cancelled"),
      supabase.from("sessions").select("id, lead_id, date, hour, status").eq("trainer_id", me.staffId).eq("is_experience", true).neq("status", "cancelled"),
    ]);
    const rawA = (ea ?? []) as { id: string; lead_id: string | null; date: string | null; hour: number | null; status: string }[];
    const rawS = (es ?? []) as { id: string; lead_id: string | null; date: string | null; hour: number | null; status: string }[];
    const leadIds = Array.from(new Set([...rawA, ...rawS].map((r) => r.lead_id).filter(Boolean))) as string[];
    const leadName = new Map<string, string>();
    if (leadIds.length) {
      const { data: ln } = await supabase.from("leads").select("id, name").in("id", leadIds);
      for (const l of (ln ?? []) as { id: string; name: string }[]) leadName.set(l.id, l.name);
    }
    const nameOf = (id: string | null) => (id ? leadName.get(id) ?? null : null);
    myExperience = [
      ...rawA.map((r) => ({ id: r.id, kind: "assessment" as const, lead_id: r.lead_id, lead_name: nameOf(r.lead_id), date: r.date, hour: r.hour, status: r.status })),
      ...rawS.map((r) => ({ id: r.id, kind: "training" as const, lead_id: r.lead_id, lead_name: nameOf(r.lead_id), date: r.date, hour: r.hour, status: r.status })),
    ];
  }
  const myExperienceToday = myExperience.filter((e) => e.date === today && e.status !== "cancelled");

  type CJoin = { clients: { name: string } | null };
  const concerns: ConcernRow[] = ((concernData ?? []) as unknown as (ConcernRow & CJoin)[]).map((r) => ({
    id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null,
    category: r.category, body: r.body, raised_by: r.raised_by, status: r.status, created_at: r.created_at,
  }));
  const mdtNotes: MdtRow[] = ((mdtData ?? []) as unknown as (MdtRow & CJoin)[]).map((r) => ({
    id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null,
    author: r.author, body: r.body, escalated: r.escalated, to_role: r.to_role, status: r.status, created_at: r.created_at,
  }));
  const openConcerns = concerns.filter((c) => c.status === "Open").length;
  const clientOpts = allClients.map((c) => ({ id: c.id, name: c.name }));

  // Resource library (only when that tab is active — needs per-file signed URLs).
  let resources: ResourceRow[] = [];
  if (tab === "library") {
    const { data: rf } = await supabase
      .from("resource_files")
      .select("id, role, folder, name, path, uploaded_by, created_at")
      .in("role", [roleKey, "all"])
      .order("folder", { ascending: true })
      .order("created_at", { ascending: false });
    resources = await Promise.all(
      ((rf ?? []) as { id: string; role: string; folder: string; name: string; path: string | null; uploaded_by: string | null; created_at: string }[]).map(async (f) => {
        let url: string | null = null;
        if (f.path) {
          const { data: signed } = await supabase.storage.from("resources").createSignedUrl(f.path, 3600);
          url = signed?.signedUrl ?? null;
        }
        return { id: f.id, role: f.role, folder: f.folder, name: f.name, url, uploaded_by: f.uploaded_by, created_at: f.created_at };
      }),
    );
  }

  // Dietitian tools.
  // The structured, multi-page diet plan (meal slots + numbered options),
  // alongside the flat diet chart above — same tab, a different document.
  let dietPlans: DietPlanRow[] = [];
  if (tab === "charts" || tab === "approvals") {
    const { data: dp } = await supabase
      .from("diet_plans")
      .select(
        "id, client_id, version, status, issued_on, kcal, protein, carbohydrate, fats, fibre, water, allergies, notes, shared_at, created_at, clients(name), " +
        "diet_plan_meals(id, seq, name, time_from, time_to, note, conditional, diet_plan_options(id, seq, food_items, qty, kcal, carb_g, protein_g, fat_g, fibre_g, micronutrients, diet_plan_option_dishes(id, dish_id, servings, seq)))",
      )
      .order("created_at", { ascending: false });
    type RawPart = { id: string; dish_id: string; servings: number; seq: number };
    type RawOption = { id: string; seq: number; food_items: string; qty: string | null; kcal: number | null; carb_g: number | null; protein_g: number | null; fat_g: number | null; fibre_g: number | null; micronutrients: string | null; diet_plan_option_dishes: RawPart[] | null };
    type RawMeal = { id: string; seq: number; name: string; time_from: string | null; time_to: string | null; note: string | null; conditional: boolean; diet_plan_options: RawOption[] | null };
    type RawPlan = {
      id: string; client_id: string; version: number; status: string; issued_on: string | null;
      kcal: number | null; protein: string | null; carbohydrate: string | null; fats: string | null; fibre: string | null; water: string | null;
      allergies: string | null; notes: string | null; shared_at: string | null; created_at: string;
      clients: { name: string } | null; diet_plan_meals: RawMeal[] | null;
    };
    dietPlans = ((dp ?? []) as unknown as RawPlan[]).map((r) => ({
      id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null, version: r.version, status: r.status,
      created_at: r.created_at, sharedAt: r.shared_at,
      targets: { kcal: r.kcal, protein: r.protein, carbohydrate: r.carbohydrate, fats: r.fats, fibre: r.fibre, water: r.water },
      meta: { allergies: r.allergies, notes: r.notes, issued_on: r.issued_on },
      meals: (r.diet_plan_meals ?? []).slice().sort((a, b) => a.seq - b.seq).map((m): PlanMeal => ({
        id: m.id, seq: m.seq, name: m.name, time_from: m.time_from, time_to: m.time_to, note: m.note, conditional: m.conditional,
        options: (m.diet_plan_options ?? []).slice().sort((a, b) => a.seq - b.seq).map((o): PlanOption => ({
          id: o.id, seq: o.seq, food_items: o.food_items, qty: o.qty, kcal: o.kcal, carb_g: o.carb_g, protein_g: o.protein_g, fat_g: o.fat_g, fibre_g: o.fibre_g, micronutrients: o.micronutrients,
          components: [...(o.diet_plan_option_dishes ?? [])].sort((a, b) => a.seq - b.seq).map((c): PlanComponent => ({
            id: c.id, seq: c.seq, dish_id: c.dish_id, servings: Number(c.servings),
          })),
        })),
      })),
    }));
  }
  // The recipe library, priced, for the chart builder's dish picker.
  //
  // Priced here rather than in the browser: the builder only ever multiplies
  // one serving by a portion, and shipping the whole ICMR food table to the
  // client so it could do that itself would be a lot of weight for two
  // numbers. The Dishes tab still loads the full table — matching ingredients
  // as you type genuinely needs it.
  //
  // A failed read must not take the tab down with it. The builder already
  // treats an empty list as "the library hasn't arrived" rather than "the
  // recipe was deleted", and the server refuses to submit, approve or send a
  // chart it could not price — so degrading here costs a picker, not a
  // safeguard. Throwing would cost the dietitian her whole Workspace.
  let chartDishes: DishOption[] = [];
  if (tab === "charts") {
    try {
      chartDishes = await pricedDishes(supabase);
    } catch {
      chartDishes = [];
    }
  }

  // Dietary Assessment Summary — the companion document to the diet plan,
  // same tab, its own client picker and version list.
  let dietAssessments: DietAssessmentRow[] = [];
  if (tab === "charts" || tab === "approvals") {
    const { data: da } = await supabase
      .from("diet_assessments")
      .select(
        "id, client_id, version, status, issued_on, consulted_on, dietitian, medical_history, existing_condition, medications, allergies, family_history, " +
        "occupation, daily_activity, exercise, sleep_hours, sleep_quality, stress_level, gut_health, weight_change, " +
        "diet_type, food_allergies, food_dislikes, supplements, " +
        "height, weight, bmi, bmr, tee, muscle_mass, fat_mass, body_fat, visceral_fat, waist_hip, " +
        "primary_goals, target_weight, timeline_weeks, objectives, " +
        "meal_frequency, meals_per_day, snacking, hydration, notes, shared_at, created_at, clients(name, dob, gender)",
      )
      .order("created_at", { ascending: false });
    type RawAssessment = {
      id: string; client_id: string; version: number; status: string; issued_on: string | null;
      consulted_on: string | null; dietitian: string | null; medical_history: string | null; existing_condition: string | null;
      medications: { medication: string; notes: string }[] | null; allergies: string | null; family_history: string | null;
      occupation: string | null; daily_activity: string | null; exercise: { type: string; frequency: string; duration: string }[] | null;
      sleep_hours: string | null; sleep_quality: string | null; stress_level: "low" | "medium" | "high" | null; gut_health: string | null; weight_change: string | null;
      diet_type: string | null; food_allergies: string | null; food_dislikes: string | null; supplements: string | null;
      height: number | null; weight: number | null; bmi: number | null; bmr: number | null; tee: number | null;
      muscle_mass: number | null; fat_mass: number | null; body_fat: number | null; visceral_fat: number | null; waist_hip: number | null;
      primary_goals: string | null; target_weight: number | null; timeline_weeks: number | null; objectives: string | null;
      meal_frequency: string | null; meals_per_day: string | null; snacking: string | null; hydration: string | null; notes: string | null;
      shared_at: string | null; created_at: string; clients: { name: string; dob: string | null; gender: string | null } | null;
    };
    dietAssessments = ((da ?? []) as unknown as RawAssessment[]).map((r) => ({
      id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null, version: r.version, status: r.status,
      created_at: r.created_at, issued_on: r.issued_on, sharedAt: r.shared_at,
      dob: r.clients?.dob ?? null, gender: r.clients?.gender ?? null,
      assessment: {
        consulted_on: r.consulted_on, dietitian: r.dietitian, medical_history: r.medical_history, existing_condition: r.existing_condition,
        medications: r.medications ?? [], allergies: r.allergies, family_history: r.family_history,
        occupation: r.occupation, daily_activity: r.daily_activity, exercise: r.exercise ?? [],
        sleep_hours: r.sleep_hours, sleep_quality: r.sleep_quality, stress_level: r.stress_level, gut_health: r.gut_health, weight_change: r.weight_change,
        diet_type: r.diet_type, food_allergies: r.food_allergies, food_dislikes: r.food_dislikes, supplements: r.supplements,
        height: r.height, weight: r.weight, bmi: r.bmi, bmr: r.bmr, tee: r.tee,
        muscle_mass: r.muscle_mass, fat_mass: r.fat_mass, body_fat: r.body_fat, visceral_fat: r.visceral_fat, waist_hip: r.waist_hip,
        primary_goals: r.primary_goals, target_weight: r.target_weight, timeline_weeks: r.timeline_weeks, objectives: r.objectives,
        meal_frequency: r.meal_frequency, meals_per_day: r.meals_per_day, snacking: r.snacking, hydration: r.hydration, notes: r.notes,
      },
    }));
  }
  // Trainer tool: per-client workout plans (draft → publish), mirrors diet charts.
  let workoutPlans: WorkoutPlanRow[] = [];
  if (tab === "planner") {
    const { data: wp } = await supabase.from("client_workouts").select("id, client_id, name, type, mode, version, status, notes, items, by_name, created_at, clients(name)").order("created_at", { ascending: false });
    workoutPlans = ((wp ?? []) as unknown as (WorkoutPlanRow & { clients: { name: string } | null })[]).map((r) => ({
      id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null, name: r.name, type: r.type, mode: r.mode,
      version: r.version, status: r.status ?? "Published", notes: r.notes, items: (r.items ?? []) as WorkoutPlanRow["items"], by_name: r.by_name, created_at: r.created_at,
    }));
  }
  let recipes: RecipeRow[] = [];
  if (tab === "recipes") {
    const { data: rc } = await supabase.from("recipes").select("id, week, name, tags, kcal, published, created_at").order("created_at", { ascending: false });
    recipes = (rc ?? []) as RecipeRow[];
  }

  // The dish library carries the whole food table with it: matching an
  // ingredient has to happen as the dietitian types, and a round trip per
  // keystroke would make that unusable. It is a few hundred rows of reference
  // data, loaded only on the tab that needs it.
  let dishes: DishRow[] = [];
  let foods: Food[] = [];
  const measures = new Map<string, Measure[]>();
  const micros = new Map<string, MicroFood>();
  if (tab === "dishes") {
    type Raw = Omit<DishRow, "items"> & { dish_items: DishRow["items"] | null };
    // Paged rather than limited: Supabase caps a response at its project "Max
    // rows" setting and ignores a larger .limit(), so an imported library of
    // 1,014 recipes arrived as 1,000 and fourteen dishes simply vanished — off
    // this screen, and out of the chart's picker with them.
    const [dsh, fds, mss] = await Promise.all([
      fetchAllRows<Raw>((from, to) => supabase.from("dishes")
        .select("id, name, cuisine, cooked_g, servings, serving_label, notes, source, source_kcal, source_carb_g, source_protein_g, source_fat_g, source_fibre_g, source_superseded, portion_g, portion_g_source, approved, approved_by, dish_items(food_code, name, raw_g, raw_g_source, note, seq)")
        // Unapproved first: with an imported library in the table, the work
        // waiting to be done is what should be at the top of the screen.
        .order("approved").order("name").range(from, to), "the recipe library"),
      // The macros and the micronutrients come back together: one read, and a
      // food that is on screen always has both or neither.
      fetchAllRows<Food & { food_code: string } & MicroFood>((from, to) => supabase.from("foods")
        .select("food_code, name, protein_g, fat_g, carb_g, fibre_g, kcal, sodium_mg, potassium_mg, calcium_mg, iron_mg, magnesium_mg, phosphorus_mg, zinc_mg, selenium_ug, vit_a_ug, vit_c_mg, vit_d_ug, vit_e_mg, vit_k_ug, vit_b1_mg, vit_b2_mg, vit_b3_mg, vit_b6_mg, folate_ug, cholesterol_mg, saturated_fat_g, oxalate_mg")
        .order("name").range(from, to), "the food table"),
      // What a cup, spoon or piece of each food weighs. A volume means nothing
      // without one, so the detail screen offers those units only where a row
      // exists — and lets the dietitian add the missing ones as she works.
      //
      // Unlike the two above, a failure here is swallowed. The measures are an
      // extra: without them every ingredient can still be weighed in grams and
      // the whole screen works. Deploying the code before running the migration
      // is a normal few minutes of any release, and the recipe library going
      // white in that window would be a far worse bug than a missing cup.
      (async () => {
        try {
          return await fetchAllRows<{ food_code: string; unit: string; grams: number; source: string; set_by: string | null }>(
            (from, to) => supabase.from("food_measures")
              .select("food_code, unit, grams, source, set_by").range(from, to), "the measures table");
        } catch {
          return [];
        }
      })(),
    ]);
    dishes = dsh.map(({ dish_items, ...d }) => ({
      ...d,
      items: [...(dish_items ?? [])].sort((a, b) => a.seq - b.seq),
    }));
    foods = fds;
    for (const f of fds) {
      micros.set(f.food_code, Object.fromEntries(
        MICRO_KEYS.map((k) => [k, (f as MicroFood)[k] == null ? null : Number((f as MicroFood)[k])]),
      ) as MicroFood);
    }
    for (const m of mss) {
      const list = measures.get(m.food_code) ?? [];
      list.push({ unit: m.unit, grams: Number(m.grams), source: m.source, set_by: m.set_by });
      measures.set(m.food_code, list);
    }
  }

  // Summaries + consolidated Blueprint sign-off.
  let consultSummaries: ConsultSummary[] = [];
  let consolidated: ConsolidatedRow[] = [];
  if (tab === "summaries") {
    // BluePrint clients from client_packages (category blueprint), not the legacy
    // clients.package_id === "bp1" hardcode.
    const { data: bpCp } = await supabase.from("client_packages").select("client_id").eq("status", "active").eq("category", "blueprint");
    const bpIdSet = new Set(((bpCp ?? []) as { client_id: string }[]).map((r) => r.client_id));
    const bpClients = allClients.filter((c) => bpIdSet.has(c.id));
    const bpIds = bpClients.map((c) => c.id);
    const [{ data: cs }, signoffRes, bpRes, asgRes, signRes] = await Promise.all([
      // ai_summary / answers / flags / draft are fetched only to answer "is this
      // row empty enough to delete" — see deletable(). They are not rendered.
      supabase.from("consultations").select("id, client_id, summary, ai_summary, answers, flags, draft, status, approved, shared, created_at, clients(name)").eq("kind", role.kind).order("created_at", { ascending: false }),
      // per-discipline INDIVIDUAL-approval status (security-definer RPC)
      supabase.rpc("blueprint_signoff"),
      bpIds.length ? supabase.from("blueprints").select("client_id, generated, consolidated").in("client_id", bpIds) : Promise.resolve({ data: [] as { client_id: string; generated: boolean; consolidated: string | null }[] }),
      // who's assigned (required signers) + who has signed the consolidated
      bpIds.length ? supabase.from("client_assignments").select("client_id, discipline").in("client_id", bpIds) : Promise.resolve({ data: [] as { client_id: string; discipline: string }[] }),
      bpIds.length ? supabase.from("blueprint_signoffs").select("client_id, discipline").in("client_id", bpIds) : Promise.resolve({ data: [] as { client_id: string; discipline: string }[] }),
    ]);
    // Which consultations have clinical records hanging off them. Two queries
    // for the whole list rather than two per row — the panel only needs to know
    // whether a Delete button is safe to offer.
    type RawConsult = ConsultSummary & {
      clients: { name: string } | null;
      ai_summary: string | null; answers: unknown[] | null; flags: unknown[] | null; draft: unknown | null;
    };
    const rawConsults = (cs ?? []) as unknown as RawConsult[];
    const consultIds = rawConsults.map((r) => r.id);
    const [ordRes, rxRes] = consultIds.length
      ? await Promise.all([
          supabase.from("orders").select("consultation_id").in("consultation_id", consultIds),
          supabase.from("prescriptions").select("consultation_id").in("consultation_id", consultIds),
        ])
      : [{ data: [] as { consultation_id: string | null }[] }, { data: [] as { consultation_id: string | null }[] }];
    const tally = (rows: { consultation_id: string | null }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) if (r.consultation_id) m.set(r.consultation_id, (m.get(r.consultation_id) ?? 0) + 1);
      return m;
    };
    const ordBy = tally(ordRes.data as { consultation_id: string | null }[] | null);
    const rxBy = tally(rxRes.data as { consultation_id: string | null }[] | null);

    consultSummaries = rawConsults.map((r) => {
      // The same rule the server action re-checks on submit. Computed here so
      // the button only appears where it will actually work.
      const verdict = deletable({
        status: r.status, summary: r.summary, aiSummary: r.ai_summary,
        answers: r.answers, flags: r.flags, draft: r.draft,
        orderCount: ordBy.get(r.id) ?? 0, prescriptionCount: rxBy.get(r.id) ?? 0,
      });
      return {
        id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null, summary: r.summary,
        status: r.status, approved: r.approved, shared: r.shared, created_at: r.created_at,
        canDelete: verdict.deletable,
        keepReason: verdict.deletable ? null : verdict.reason,
      };
    });
    // Individual-summary approval per discipline (from the RPC).
    const KINDS = ["doctor", "diet", "trainer", "coach", "psych"] as const;
    const KIND2DISC: Record<string, string> = { doctor: "doctor", diet: "dietitian", trainer: "trainer", coach: "coach", psych: "psychologist" };
    const approvedByDisc = new Map<string, Record<string, boolean>>();
    for (const s of (signoffRes.data ?? []) as Record<string, unknown>[]) {
      const cid = String(s.client_id);
      const rec: Record<string, boolean> = {};
      for (const k of KINDS) rec[KIND2DISC[k]] = Boolean(s[k]);
      approvedByDisc.set(cid, rec);
    }
    const requiredByClient = new Map<string, string[]>();
    for (const a of (asgRes.data ?? []) as { client_id: string; discipline: string }[]) {
      if (!["doctor", "dietitian", "trainer", "coach", "psychologist"].includes(a.discipline)) continue;
      (requiredByClient.get(a.client_id) ?? requiredByClient.set(a.client_id, []).get(a.client_id)!).push(a.discipline);
    }
    const signedByClient = new Map<string, Set<string>>();
    for (const s of (signRes.data ?? []) as { client_id: string; discipline: string }[]) {
      (signedByClient.get(s.client_id) ?? signedByClient.set(s.client_id, new Set()).get(s.client_id)!).add(s.discipline);
    }
    const bpMap = new Map(((bpRes.data ?? []) as { client_id: string; generated: boolean; consolidated: string | null }[]).map((b) => [b.client_id, b]));
    consolidated = bpClients.map((c) => {
      const bp = bpMap.get(c.id);
      const required = requiredByClient.get(c.id) ?? [];
      const approved = approvedByDisc.get(c.id) ?? {};
      const signedSet = signedByClient.get(c.id) ?? new Set<string>();
      const signedByDisc: Record<string, boolean> = {};
      for (const d of required) signedByDisc[d] = signedSet.has(d);
      return { client_id: c.id, name: c.name, code: c.code, required, approvedByDisc: approved, signedByDisc, generated: bp?.generated ?? false, consolidated: bp?.consolidated ?? null };
    });
  }

  // Appointments board. Shows this workspace's roster clients' bookings PLUS any
  // booking where this clinician is the provider — a clinician runs the
  // appointments they're booked for even if that client isn't formally in their
  // roster (e.g. a fitness assessment booked with them). Merge + dedupe.
  let apptRows: ApptRow[] = [];
  if (tab === "appts") {
    const scopedIds = scoped.map((c) => c.id);
    const cols = "id, client_id, provider_id, date, hour, type, title, status, is_experience, clients(name)";
    const [rosterRes, mineRes] = await Promise.all([
      scopedIds.length
        ? supabase.from("appointments").select(cols).in("client_id", scopedIds).order("date", { ascending: false }).limit(200)
        : Promise.resolve({ data: [] as unknown[] }),
      me.staffId
        ? supabase.from("appointments").select(cols).eq("provider_id", me.staffId).order("date", { ascending: false }).limit(200)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);
    // Show only appointments that are actually this clinician's: their own
    // bookings (provider = them), or appointments in their own discipline. Without
    // the discipline gate, the roster query leaks a shared client's OTHER-
    // discipline appointments — e.g. a dietitian seeing the trainer's fitness
    // reassessment for a client they both look after.
    const catOf = await loadCatOf(supabase);
    const CAT_TO_WSKEY: Record<string, string> = { "Diet Consultation": "diet", "Doctor Consultation": "doctor", "Fitness Services": "trainer", "Counselling": "psych", "Coaching": "coach" };
    const merged = new Map<string, ApptRow & { clients: { name: string } | null; is_experience?: boolean | null }>();
    for (const a of [...(rosterRes.data ?? []), ...(mineRes.data ?? [])] as unknown as (ApptRow & { clients: { name: string } | null; is_experience?: boolean | null })[]) {
      if (a.is_experience) continue; // pre-sale trials are folded in separately below
      const isMine = !!me.staffId && a.provider_id === me.staffId;
      const myDiscipline = CAT_TO_WSKEY[catOf(a.type) ?? ""] === roleKey;
      if (isMine || myDiscipline) merged.set(a.id, a);
    }
    apptRows = [...merged.values()].map((a) => ({
      id: a.id, client_id: a.client_id, provider_id: a.provider_id, client_name: a.clients?.name ?? null, date: a.date, hour: a.hour, type: a.type, title: a.title, status: a.status,
    }));
    // Fold in my pre-sale trial bookings (lead-based, no client_id) so they
    // aren't invisible on the board that's supposed to show my day.
    const expAsAppt: ApptRow[] = myExperience.map((e) => ({
      id: e.id, client_id: null, provider_id: me.staffId ?? null, client_name: e.lead_name ?? "Lead",
      date: e.date ?? today, hour: e.hour,
      type: e.kind === "assessment" ? "Free fitness assessment" : "Free trial training session",
      title: null, status: e.status, is_experience: true, exp_kind: e.kind, lead_id: e.lead_id,
    }));
    apptRows = [...apptRows, ...expAsAppt];
  }

  // Follow-ups board (coach) — role-scoped to this workspace's clients.
  let fuRows: FuRow[] = [];
  if (tab === "followups") {
    const scopedIds = scoped.map((c) => c.id);
    const { data: fu } = scopedIds.length
      ? await supabase.from("followups").select("id, client_id, kind, label, due_date, priority, status, clients(name)").in("client_id", scopedIds).order("due_date").limit(200)
      : { data: [] as unknown[] };
    fuRows = ((fu ?? []) as unknown as (FuRow & { clients: { name: string } | null })[]).map((f) => ({
      id: f.id, client_id: f.client_id, client_name: f.clients?.name ?? null, kind: f.kind, label: f.label, due_date: f.due_date, priority: f.priority, status: f.status,
    }));
  }

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const fmtHour = (h: number | null) => {
    if (h == null) return "—";
    const am = h < 12, hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:00 ${am ? "AM" : "PM"}`;
  };

  // One flat queue across all three document types. Built here because the page
  // already holds the fetched rows; the component stays a dumb renderer.
  const approvalRows: ApprovalRow[] = tab !== "approvals" ? [] : [
    ...dietPlans.filter((p) => p.status === "in_review").map((p): ApprovalRow => ({
      kind: "plan", id: p.id, clientId: p.client_id, clientName: p.client_name,
      version: p.version, createdAt: p.created_at, author: null,
      summary: [
        p.targets.kcal ? `${p.targets.kcal} kcal` : null,
        p.targets.protein ? `${p.targets.protein} protein` : null,
        `${p.meals.length} meal${p.meals.length === 1 ? "" : "s"}`,
      ].filter(Boolean).join(" · ") || null,
      readHref: `/diet-plan/${p.id}/print`,
    })),
    ...dietAssessments.filter((a) => a.status === "in_review").map((a): ApprovalRow => ({
      kind: "assess", id: a.id, clientId: a.client_id, clientName: a.client_name,
      version: a.version, createdAt: a.created_at, author: a.assessment.dietitian,
      summary: [
        a.assessment.daily_activity,
        a.assessment.tee ? `TEE ${a.assessment.tee} kcal` : null,
      ].filter(Boolean).join(" · ") || null,
      readHref: `/diet-assessment/${a.id}/print`,
    })),
  ];

  // Tab bar — every tab renders in place.
  const tabItems = tabs.map((t) => ({ key: t.key, label: t.label, href: `/workspace?role=${roleKey}&tab=${t.key}` }));

  return (
    <div style={{ maxWidth: 1160 }}>
      <RealtimeRefresh tables={["consultations", "appointments", "sessions", "clients", "concerns", "mdt_notes", "resource_files", "diet_plans", "diet_plan_meals", "diet_plan_options", "diet_plan_option_dishes", "diet_assessments", "client_workouts", "recipes", "dishes", "blueprints", "followups"]} />

      {/* Workspace chrome — one discipline at a time. Clinicians have exactly
          one; admins switch with the header persona menu. The Medical Director
          briefly had chips here, added when the approval screen still lived in
          the dietitian's workspace and they had no way to reach it. The
          Approvals tab now follows them into whichever workspace they are in,
          so the chips were solving a problem that no longer exists — and a row
          of other people's job titles on your own screen reads as impersonation
          rather than oversight. Their cross-discipline ACCESS is unchanged
          (WS_OVERSIGHT, and is_admin() in SQL); a ?role= link still resolves. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>{role.label}</h1>
          <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>Your clients, consultations, blueprint sign-off and role tools in one place</p>
        </div>
      </div>

      {readOnly && (
        <div style={{ background: "var(--amber-bg)", color: "var(--amber-text)", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
          Viewing the {disciplineLabel(roleKey)} workspace — read-only. You can review client details but can&apos;t edit another discipline&apos;s records.
        </div>
      )}

      {/* Tab bar */}
      <div style={{ marginBottom: 16 }}>
        <SegTabs active={tab} items={tabItems} />
      </div>

      {/* ---- DASHBOARD ---- */}
      {tab === "dash" && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <MetricCard label="My clients" value={scoped.length} href={`/workspace?role=${roleKey}&tab=clients`} />
            <MetricCard label={isTrainer ? "Scheduled today" : "Appointments today"} value={todayList.length + myExperienceToday.length} href={`/workspace?role=${roleKey}&tab=appts`} />
            <MetricCard label="Pending summaries" value={pendingSummaries ?? 0} color="var(--amber-text-soft)" href={`/workspace?role=${roleKey}&tab=summaries`} />
            <MetricCard label="Client concerns" value={openConcerns} color={openConcerns ? "var(--amber-text-soft)" : undefined} href={`/workspace?role=${roleKey}&tab=concerns`} />
            <MetricCard label="MDT updates" value={mdtNotes.length} href={`/workspace?role=${roleKey}&tab=board`} />
          </div>

          {myAttention.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <AttentionPanel flags={myAttention} viewerRole={me.role} viewerStaffId={me.staffId ?? null} />
            </div>
          )}

          {overdueAppts.length > 0 && (
            <div style={{ ...box, overflow: "hidden", marginBottom: 16, border: "1px solid var(--red-bg)" }}>
              <div style={{ padding: "12px 16px", fontWeight: 700, color: "var(--red-text)", display: "flex", alignItems: "center", gap: 8 }}>
                Overdue — not yet conducted
                <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{overdueAppts.length}</span>
              </div>
              {overdueAppts.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {a.client_id
                      ? <Link href={`/clients/${a.client_id}${roQuery}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>{a.client_name ?? "—"}</Link>
                      : <b style={{ fontSize: 13 }}>{a.client_name ?? "—"}</b>}
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{role.short} · {a.type || "Consultation"} — was {new Date(`${a.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" })}</div>
                  </div>
                  {!readOnly && a.status === "scheduled" && a.client_id && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      <form action={startConsultFromAppointment} style={{ margin: 0 }}>
                        <input type="hidden" name="appointment_id" value={a.id} />
                        <SubmitButton pendingLabel="Opening…" doneLabel="Opening…" style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>▶ Start</SubmitButton>
                      </form>
                      <MarkConsultDone appointmentId={a.id} who={a.client_name} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ ...box, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", fontWeight: 700 }}>Today — {todayLabel()}</div>
              {todayList.map((a) => {
                const st = a.client_id ? clientStatus(wsStatuses.get(a.client_id), wsDisc) : null;
                const detail = a.isSession
                  ? "Training session"
                  : `${role.short} · ${a.type || "Consultation"}${a.title ? ` — ${a.title}` : ""}`;
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        {a.client_id
                          ? <Link href={`/clients/${a.client_id}${roQuery}`} style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>{a.client_name ?? "—"}</Link>
                          : <b style={{ fontSize: 13 }}>{a.client_name ?? "—"}</b>}
                        {st && <ClientStatusBadge status={st} size="sm" />}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{detail}</div>
                    </div>
                    <b style={{ fontSize: 13 }}>{fmtHour(a.hour)}</b>
                    {a.isSession && (
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", ...(a.status === "completed" ? { background: "var(--green-bg)", color: "var(--green-text)" } : { background: "var(--amber-bg)", color: "var(--amber-text)" }) }}>{a.status === "completed" ? "✓ Done" : "Pending"}</span>
                    )}
                    {!readOnly && a.isSession && a.status !== "completed" && a.client_id && (
                      <form action={markSessionComplete} style={{ margin: 0 }}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="client_id" value={a.client_id} />
                        <SubmitButton pendingLabel="Saving…" style={{ border: "1px solid var(--ink)", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Mark done</SubmitButton>
                      </form>
                    )}
                    {!readOnly && !a.isSession && a.status === "scheduled" && a.client_id && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                        <form action={startConsultFromAppointment} style={{ margin: 0 }}>
                          <input type="hidden" name="appointment_id" value={a.id} />
                          <SubmitButton pendingLabel="Opening…" doneLabel="Opening…" style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>▶ Start</SubmitButton>
                        </form>
                        <MarkConsultDone appointmentId={a.id} who={a.client_name} />
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Pre-sale trial bookings assigned to me — shown here so a lead's
                  free assessment/training isn't invisible just because they're
                  not a client yet. */}
              {myExperienceToday.map((e) => (
                <div key={`exp-${e.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13 }}>{e.lead_name ?? "Lead"}</b>
                    <span style={{ marginLeft: 7, background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Trial</span>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{e.kind === "assessment" ? "Free fitness assessment" : "Free trial training session"}</div>
                  </div>
                  <b style={{ fontSize: 13 }}>{fmtHour(e.hour)}</b>
                  {!readOnly && <TrialOutcomeActions id={e.id} kind={e.kind} status={e.status} />}
                </div>
              ))}
              {todayList.length === 0 && myExperienceToday.length === 0 && (
                <div style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>Nothing scheduled today.</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!readOnly && (
              <div style={{ ...box, padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Quick actions</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link href={`/workspace?role=${roleKey}&tab=summaries`} style={qa}>Summaries</Link>
                  <Link href="/appointments" style={qa}>Appointment Calendar</Link>
                  <Link href="/blueprint" style={qa}>BluePrint</Link>
                  {roleKey === "diet" && <Link href="/meals" style={qa}>Meal Monitoring</Link>}
                  {roleKey === "trainer" && <Link href="/trainer" style={qa}>Session Board</Link>}
                  {roleKey === "coach" && <Link href="/followups" style={qa}>Follow-ups</Link>}
                  {/* With /emr and /orders out of the sidebar, these quick
                      actions are the doctor's front door to both. */}
                  {roleKey === "doctor" && <Link href="/emr" style={qa}>Client Records</Link>}
                  {roleKey === "doctor" && <Link href="/orders" style={qa}>Orders &amp; Labs</Link>}
                </div>
              </div>
              )}
              <div style={{ ...box, padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>My clients <span style={{ color: "var(--muted)", fontWeight: 500 }}>· {scoped.length}</span></div>
                {scoped.slice(0, 5).map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderTop: "1px solid var(--border)" }}>
                    <span>{c.name}</span>
                    <Link href={`/clients/${c.id}${roQuery}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontSize: 12 }}>Open →</Link>
                  </div>
                ))}
                <Link href={`/workspace?role=${roleKey}&tab=clients`} style={{ display: "inline-block", marginTop: 8, color: "var(--brand-text)", textDecoration: "none", fontSize: 12.5, fontWeight: 600 }}>View all clients →</Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---- MY CLIENTS ---- */}
      {tab === "clients" && <WorkspaceClients role={roleKey} color={role.color} clients={rosterRows} linkQuery={roQuery} />}

      {/* ---- MEAL MONITORING (dietitian) ---- */}
      {tab === "meals" && <MealMonitoringSection me={me} date={searchParams.d} />}

      {/* ---- BLUEPRINT SIGN-OFF ---- */}
      {tab === "bp" && <BlueprintSection me={me} />}

      {/* ---- WHITEBOARD ---- */}
      {tab === "whiteboard" && <WhiteboardSection me={me} />}

      {/* ---- EXERCISE LIBRARY (trainer) ---- */}
      {tab === "exlib" && <ExerciseLibrarySection />}

      {/* ---- APPOINTMENTS ---- */}
      {tab === "appts" && <AppointmentsBoard appts={apptRows} today={today} myStaffId={me?.staffId ?? null} canStartAny={["Super Admin", "Administrator", "Manager"].includes(me.role) && !readOnly} />}

      {/* ---- HEALTH COACHING (coach) ---- */}
      {tab === "coaching" && <CoachMarkersSection me={me} />}

      {/* ---- FOLLOW-UPS (coach) ---- */}
      {tab === "followups" && <FollowupsBoard rows={fuRows} today={today} />}

      {/* ---- SUMMARIES → BLUEPRINT SIGN-OFF ---- */}
      {tab === "summaries" && <SummariesPanel roleLabel={role.short} roleKind={role.kind} consults={consultSummaries} consolidated={consolidated} clients={clientOpts} viewerDisc={wsDisc} canSignAny={["Super Admin", "Administrator", "Manager"].includes(me.role)} canSend={canDeliverDoc(me.role, "summary") && !readOnly} pdf={pdfReadiness()} whatsapp={watiReadiness()} />}

      {/* ---- CONCERNS ---- */}
      {tab === "concerns" && <ConcernsPanel concerns={concerns} />}

      {/* ---- MDT BOARD ---- */}
      {tab === "board" && <MdtBoard notes={mdtNotes} clients={clientOpts} />}

      {/* ---- RESOURCE LIBRARY ---- */}
      {tab === "library" && <ResourceLibrary role={roleKey} roleLabel={role.short} files={resources} />}

      {/* ---- APPROVALS (Medical Director) ----------------------------------
           The documents ARE the list. The dietitian's own sections are built
           around a client picker, which is right for an author working one
           client at a time and wrong for a reviewer, who cannot know which
           clients are waiting. ---- */}
      {tab === "approvals" && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, margin: "0 0 2px" }}>Awaiting your approval</h2>
            <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>
              {approvalRows.length
                ? `${approvalRows.length} document${approvalRows.length === 1 ? "" : "s"} submitted by the dietitian. Nothing reaches the client until you publish it.`
                : "Nothing is waiting on you right now."}
            </p>
          </div>
          <ApprovalsQueue rows={approvalRows} />
        </>
      )}

      {/* ---- DIET CHART (dietitian) ----
           One screen for a client's nutrition write-up. The assessment and the
           chart were two stacked sections with a client dropdown each, so you
           picked the same person twice and could leave them pointing at two
           different clients. Now: pick once, switch halves.

           Scoped to this dietitian's OWN roster — the same set the "My clients"
           tab shows — not every client in the clinic. The old dropdown listed
           all of them, so she scrolled past people she will never write a chart
           for. ---- */}
      {tab === "charts" && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Diet chart</div>
          <DietChartSection
            plans={dietPlans} assessments={dietAssessments} dishes={chartDishes}
            clients={rosterRows.map((r) => ({ id: r.id, name: r.name }))}
            canReview={canReviewDietChart(me.role)} canCompose={canWriteNutrition(me.role) && !readOnly}
            pdf={pdfReadiness()} whatsapp={watiReadiness()} />
        </div>
      )}

      {/* ---- WORKOUT PLANNER (trainer) ---- */}
      {tab === "planner" && <WorkoutPlanner plans={workoutPlans} clients={clientOpts} />}

      {/* ---- RECIPES (dietitian) ---- */}
      {tab === "recipes" && <RecipeLibrary recipes={recipes} />}

      {/* ---- DISH LIBRARY (dietitian) ---- */}
      {tab === "dishes" && (
        <DishLibrary dishes={dishes} foods={foods} measures={measures} micros={micros} canEdit={!readOnly && canWriteNutrition(me.role)} />
      )}

    </div>
  );
}

const qa: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" };
