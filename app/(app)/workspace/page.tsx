import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getViewRole } from "@/lib/auth";
import { canSee, isClinician, canReviewDietChart } from "@/lib/roles";
import { getPersona } from "@/lib/personas";
import { todayISO, todayLabel } from "@/lib/today";
import { loadClientStatuses, clientStatus } from "@/lib/client-status";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import SegTabs from "@/components/SegTabs";
import MetricCard from "@/components/MetricCard";
import WorkspaceClients, { type WsClientRow } from "@/components/WorkspaceClients";
import MealMonitoringSection from "@/components/MealMonitoringSection";
import BlueprintSection from "@/components/BlueprintSection";
import ConcernsPanel, { type ConcernRow } from "@/components/ConcernsPanel";
import MdtBoard, { type MdtRow } from "@/components/MdtBoard";
import ResourceLibrary, { type ResourceRow } from "@/components/ResourceLibrary";
import DietCharts, { type DietChartRow } from "@/components/DietCharts";
import WorkoutPlanner, { type WorkoutPlanRow } from "@/components/WorkoutPlanner";
import { loadCatOf } from "@/lib/appt-match";
import RecipeLibrary, { type RecipeRow } from "@/components/RecipeLibrary";
import SummariesPanel, { type ConsultSummary, type ConsolidatedRow } from "@/components/SummariesPanel";
import ClientMonitoring, { type MonitorRow } from "@/components/ClientMonitoring";
import AppointmentsBoard, { type ApptRow } from "@/components/AppointmentsBoard";
import TrialOutcomeActions from "@/components/TrialOutcomeActions";
import ClientStatusBadge from "@/components/ClientStatusBadge";
import SubmitButton from "@/components/SubmitButton";
import { startConsultFromAppointment, markSessionComplete } from "@/lib/actions";
import FollowupsBoard, { type FuRow } from "@/components/FollowupsBoard";
import {
  WS_ROLES, WS_TABS, wsRole, roleFromPersonaKind, roleFromStaffRole, scopeClients,
  visibleWorkspaces, canEditWorkspace, type WsClient, type WsRoleKey,
} from "@/lib/workspaces";

export const dynamic = "force-dynamic";

type ClientRow = WsClient & { used: number | null; packages: { name: string; sessions: number } | null };

export default async function WorkspacePage({ searchParams }: { searchParams: { role?: string; tab?: string; d?: string } }) {
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
  const RO_TABS = ["dash", "clients", "monitor"];
  const tabs = readOnly ? WS_TABS[roleKey].filter((t) => RO_TABS.includes(t.key)) : WS_TABS[roleKey];

  // Resolve active tab — only in-workspace tabs (live or stub) are selectable here.
  const inWs = tabs.filter((t) => !t.href);
  const tab = inWs.find((t) => t.key === searchParams.tab) ? searchParams.tab! : "dash";

  const supabase = createClient();
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
  const { data: asgData } = await supabase.from("client_assignments").select("client_id").eq("discipline", wsDiscKey);
  const assignedIds = new Set(((asgData ?? []) as { client_id: string }[]).map((a) => a.client_id));
  // Also treat a booked appointment as ownership: any client with a non-cancelled
  // appointment whose provider is in this discipline belongs on the roster — a
  // clinician shouldn't have an appointment with someone who isn't in "My
  // clients". This covers the gap before the care-team row is written.
  const { data: apptOwn } = await supabase
    .from("appointments").select("client_id, staff:provider_id(role)").neq("status", "cancelled").not("client_id", "is", null);
  for (const a of (apptOwn ?? []) as unknown as { client_id: string | null; staff: { role: string } | null }[]) {
    if (a.client_id && WS_ROLE_TO_KIND[a.staff?.role ?? ""] === role.kind) assignedIds.add(a.client_id);
  }
  const scoped = scopeClients(roleKey, allClients, trainingIds, assignedIds);
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
  let dietCharts: DietChartRow[] = [];
  if (tab === "charts") {
    const { data: dc } = await supabase.from("diet_charts").select("id, client_id, version, status, calories, protein, notes, meals, by_name, created_at, review_note, reviewed_by, clients(name)").order("created_at", { ascending: false });
    dietCharts = ((dc ?? []) as unknown as (DietChartRow & { clients: { name: string } | null })[]).map((r) => ({
      id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null, version: r.version, status: r.status,
      calories: r.calories, protein: r.protein, notes: r.notes, meals: (r.meals ?? []) as [string, string][], by_name: r.by_name, created_at: r.created_at,
      review_note: r.review_note, reviewed_by: r.reviewed_by,
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
      supabase.from("consultations").select("id, client_id, summary, status, approved, shared, created_at, clients(name)").eq("kind", role.kind).order("created_at", { ascending: false }),
      // per-discipline INDIVIDUAL-approval status (security-definer RPC)
      supabase.rpc("blueprint_signoff"),
      bpIds.length ? supabase.from("blueprints").select("client_id, generated, consolidated").in("client_id", bpIds) : Promise.resolve({ data: [] as { client_id: string; generated: boolean; consolidated: string | null }[] }),
      // who's assigned (required signers) + who has signed the consolidated
      bpIds.length ? supabase.from("client_assignments").select("client_id, discipline").in("client_id", bpIds) : Promise.resolve({ data: [] as { client_id: string; discipline: string }[] }),
      bpIds.length ? supabase.from("blueprint_signoffs").select("client_id, discipline").in("client_id", bpIds) : Promise.resolve({ data: [] as { client_id: string; discipline: string }[] }),
    ]);
    consultSummaries = ((cs ?? []) as unknown as (ConsultSummary & { clients: { name: string } | null })[]).map((r) => ({
      id: r.id, client_id: r.client_id, client_name: r.clients?.name ?? null, summary: r.summary, status: r.status, approved: r.approved, shared: r.shared, created_at: r.created_at,
    }));
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

  // Client Monitoring.
  let monitorRows: MonitorRow[] = [];
  if (tab === "monitor") {
    const scopedIds = scoped.map((c) => c.id);
    const { data: fu } = scopedIds.length
      ? await supabase.from("followups").select("client_id, status").in("client_id", scopedIds).eq("status", "pending")
      : { data: [] as { client_id: string; status: string }[] };
    const fuCount = new Map<string, number>();
    for (const f of (fu ?? []) as { client_id: string }[]) fuCount.set(f.client_id, (fuCount.get(f.client_id) ?? 0) + 1);
    const conCount = new Map<string, number>();
    for (const c of concerns) if (c.status === "Open" && c.client_id) conCount.set(c.client_id, (conCount.get(c.client_id) ?? 0) + 1);
    const lastMdt = new Map<string, string>();
    for (const m of mdtNotes) if (m.client_id && !lastMdt.has(m.client_id)) lastMdt.set(m.client_id, m.body);
    monitorRows = scoped.map((c) => {
      const cr = c as ClientRow;
      return {
        id: c.id, name: c.name, code: c.code, pkg: cr.packages?.name ?? c.package_id,
        sessionsUsed: cr.used ?? 0, sessionsTotal: cr.packages?.sessions ?? 0,
        openFollowups: fuCount.get(c.id) ?? 0, openConcerns: conCount.get(c.id) ?? 0,
        conditions: c.conditions, goals: c.goals ?? [], lastMdt: lastMdt.get(c.id) ?? null,
      };
    });
  }

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const fmtHour = (h: number | null) => {
    if (h == null) return "—";
    const am = h < 12, hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr}:00 ${am ? "AM" : "PM"}`;
  };

  // Tab bar — live/stub tabs stay in the workspace, href tabs bridge to existing pages.
  const tabItems = tabs.map((t) => ({ key: t.key, label: t.label, href: t.href ?? `/workspace?role=${roleKey}&tab=${t.key}` }));
  const stubDef = tabs.find((t) => t.key === tab && !t.live && !t.href);

  return (
    <div style={{ maxWidth: 1160 }}>
      <RealtimeRefresh tables={["consultations", "appointments", "sessions", "clients", "concerns", "mdt_notes", "resource_files", "diet_charts", "client_workouts", "recipes", "blueprints", "followups"]} />

      {/* Workspace chrome — one discipline only; switch via the header persona menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>{role.label}</h1>
          <p style={{ color: "var(--muted)", fontSize: 12.5, margin: 0 }}>Your clients, consultations, blueprint sign-off and role tools in one place</p>
        </div>
      </div>

      {readOnly && (
        <div style={{ background: "var(--amber-bg)", color: "var(--amber-text)", border: "1px solid #fde68a", borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
          Viewing the {role.short} workspace — read-only. You can review client details but can&apos;t edit another discipline&apos;s records.
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
                      <form action={startConsultFromAppointment} style={{ margin: 0 }}>
                        <input type="hidden" name="appointment_id" value={a.id} />
                        <SubmitButton pendingLabel="Opening…" doneLabel="Opening…" style={{ border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>▶ Start</SubmitButton>
                      </form>
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
                  {roleKey === "doctor" && <Link href="/emr" style={qa}>Patient Records</Link>}
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

      {/* ---- APPOINTMENTS ---- */}
      {tab === "appts" && <AppointmentsBoard appts={apptRows} today={today} myStaffId={me?.staffId ?? null} canStartAny={["Super Admin", "Administrator", "Manager"].includes(me.role) && !readOnly} />}

      {/* ---- FOLLOW-UPS (coach) ---- */}
      {tab === "followups" && <FollowupsBoard rows={fuRows} today={today} />}

      {/* ---- SUMMARIES → BLUEPRINT SIGN-OFF ---- */}
      {tab === "summaries" && <SummariesPanel roleLabel={role.short} roleKind={role.kind} consults={consultSummaries} consolidated={consolidated} clients={clientOpts} viewerDisc={wsDisc} canSignAny={["Super Admin", "Administrator", "Manager"].includes(me.role)} />}

      {/* ---- CONCERNS ---- */}
      {tab === "concerns" && <ConcernsPanel concerns={concerns} />}

      {/* ---- MDT BOARD ---- */}
      {tab === "board" && <MdtBoard notes={mdtNotes} clients={clientOpts} />}

      {/* ---- CLIENT MONITORING ---- */}
      {tab === "monitor" && <ClientMonitoring role={roleKey} rows={monitorRows} linkQuery={roQuery} />}

      {/* ---- RESOURCE LIBRARY ---- */}
      {tab === "library" && <ResourceLibrary role={roleKey} roleLabel={role.short} files={resources} />}

      {/* ---- DIET CHARTS (dietitian) ---- */}
      {tab === "charts" && <DietCharts charts={dietCharts} clients={clientOpts} canReview={canReviewDietChart(me.role)} canCompose={roleKey === "diet" && !readOnly} />}

      {/* ---- WORKOUT PLANNER (trainer) ---- */}
      {tab === "planner" && <WorkoutPlanner plans={workoutPlans} clients={clientOpts} />}

      {/* ---- RECIPES (dietitian) ---- */}
      {tab === "recipes" && <RecipeLibrary recipes={recipes} />}

      {/* ---- STUB TABS (later phases) ---- */}
      {stubDef && (
        <div style={{ ...box, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{stubDef.label}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>{stubDef.note}</div>
        </div>
      )}
    </div>
  );
}

const qa: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" };
