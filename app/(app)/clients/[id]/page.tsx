
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SessionActions from "@/components/SessionActions";
import StrengthBlockActions from "@/components/StrengthBlockActions";
import PortalLoginForm from "@/components/PortalLoginForm";
import FileUploadForm from "@/components/FileUploadForm";
import { fmtDate, fmtTime, IST } from "@/lib/datetime";
import FilesGrid from "@/components/FilesGrid";
import MeasurementForm from "@/components/MeasurementForm";
import InBodyComparison, { type Measure } from "@/components/InBodyComparison";
import { WearableForm, WearableConnect } from "@/components/WearableForm";
import { removeWorkout } from "@/lib/actions";
import { todayISO } from "@/lib/today";
import { packageCategory } from "@/lib/packages";
import { ageFromDob } from "@/lib/dob";
import InvoiceActions from "@/components/InvoiceActions";
import InvoiceForm from "@/components/InvoiceForm";
import AddPackage from "@/components/AddPackage";
import VoidPackageButton from "@/components/VoidPackageButton";
import { getProfile } from "@/lib/auth";
import { canWrite, canConsult, canBill, canManageInvoices, canVoidPackage, isBillingOverseer, canEmr, canSee, canManageSessions, isHealthCoachSupervisor } from "@/lib/roles";
import { canWriteFitness } from "@/lib/discipline";

import RealtimeRefresh from "@/components/RealtimeRefresh";
import ComprehensiveProtocol from "@/components/ComprehensiveProtocol";
import PackageStatusPanel from "@/components/PackageStatusPanel";
import { getPackageStatus } from "@/lib/package-status";
import PTProtocol from "@/components/PTProtocol";
import RepairJourneyButton from "@/components/RepairJourneyButton";
import RenewMembership from "@/components/RenewMembership";
import FreezeToggle from "@/components/FreezeToggle";
import BloodActions from "@/components/BloodActions";
import ClientStatusBadge from "@/components/ClientStatusBadge";
import { loadClientStatuses, clientStatus, disciplineForRole } from "@/lib/client-status";
import ScheduleSessionsForm from "@/components/ScheduleSessionsForm";
import ActivityTimeline from "@/components/ActivityTimeline";
import { buildTimeline, atDay, type TimelineEvent } from "@/lib/timeline";
import { getComprehensiveView, getPTView } from "@/lib/actions";
import { RingMeter, Gauge } from "@/components/Meters";
import SegTabs from "@/components/SegTabs";
import { BP_SCORES } from "@/lib/blueprint";
import { DISCIPLINES, disciplineLabel } from "@/lib/disciplines";
import HealthCoachCarePanel, { type ClinicalReferralView, type SafetyEventView } from "@/components/HealthCoachCarePanel";
import HealthCoachGoalsPanel, { type CoachingAdherenceView, type CoachingBarrierView, type CoachingGoalView } from "@/components/HealthCoachGoalsPanel";
import type { ClientGoalOutcome } from "@/lib/client-goal-outcome";
import CoachProgrammeLifecyclePanel from "@/components/CoachProgrammeLifecyclePanel";
import type { CoachProgrammeLifecycle, CoachProgrammeLifecycleEvent } from "@/lib/coach-programme-lifecycle";
import HealthCoachBaselinePanel, { type CoachBaselineView, type ScreeningResultView } from "@/components/HealthCoachBaselinePanel";
import CoachingSummary from "@/components/CoachingSummary";

// Report types, told apart at a glance in the timeline.
const REPORT_LABEL: Record<string, string> = {
  blood_report: "Blood",
  medical_report: "Medical",
  inbody: "InBody",
};
const REPORT_CHIP: Record<string, React.CSSProperties> = {
  blood_report: { background: "var(--red-bg)", color: "var(--red-text)" },
  medical_report: { background: "var(--blue-bg, #e0f2fe)", color: "var(--blue-text, #0369a1)" },
  inbody: { background: "var(--green-bg)", color: "var(--green-text)" },
};

// The service as it is sold and understood, not the internal kind string.
const SERVICE_NAME: Record<string, string> = {
  Doctor: "Doctor consultations",
  Diet: "Diet consultations",
  Trainer: "Fitness assessments",
  Coach: "Health coaching sessions",
  Psychologist: "Psychology sessions",
};
// Singular, as it reads inside a sentence: "Initial diet consultation".
const SESSION_NOUN: Record<string, string> = {
  Doctor: "doctor consultation",
  Diet: "diet consultation",
  Trainer: "fitness assessment",
  Coach: "health coaching session",
  Psychologist: "psychology session",
};

const SERVICE_DISCIPLINE: Record<string, string> = {
  Doctor: "doctor", Diet: "dietitian", Trainer: "trainer",
  Coach: "coach", Psychologist: "psychologist",
};


const REPORT_KINDS_SET = new Set(["blood_report", "medical_report", "inbody"]);

// Consultation disciplines. "Trainer" reads as a fitness assessment on the
// record, which is what the session actually is.
const CONSULT_LABEL: Record<string, string> = {
  Doctor: "Doctor",
  Diet: "Diet",
  Trainer: "Fitness",
  Coach: "Coach",
  Psychologist: "Psychology",
};
const CONSULT_CHIP: Record<string, React.CSSProperties> = {
  Doctor: { background: "var(--red-bg)", color: "var(--red-text)" },
  Diet: { background: "var(--green-bg)", color: "var(--green-text)" },
  Trainer: { background: "var(--amber-bg)", color: "var(--amber-text)" },
  Coach: { background: "var(--blue-bg, #e0f2fe)", color: "var(--blue-text, #0369a1)" },
  Psychologist: { background: "var(--neutral-bg)", color: "var(--muted)" },
};

export const dynamic = "force-dynamic";

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{value ?? "—"}</div>
    </div>
  );
}

export default async function ClientDetailPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; ro?: string; referral?: string; referral_reason?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const tab = ["overview", "timeline", "card"].includes(searchParams.tab ?? "") ? searchParams.tab! : "overview";
  // Read-only view (reached from another discipline's workspace): hide all edits.
  const ro = searchParams.ro === "1";

  // The card carries the client's whole clinical and financial life. Nav hid it
  // from Finance and HR; the URL did not. Gate it on the same list that governs
  // the clients section, before anything is fetched.
  const gate = await getProfile();
  if (!gate || !canSee(gate.role, "/clients")) redirect("/dashboard");

  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*, packages(name, sessions, is_facility, price)")
    .eq("id", params.id)
    .maybeSingle();

  if (!client) notFound();
  const c0 = client as Record<string, unknown>;
  const ageOf = (dob: unknown): number | null =>
    typeof dob === "string" ? ageFromDob(dob) : null;

  const [{ data: sessions }, { data: trainerData }, { data: consultData }, { data: protoData }, { data: dietPlanData }, { data: dietAssessmentData }] = await Promise.all([
    supabase.from("sessions").select("*, staff(name)").eq("client_id", params.id).order("seq", { ascending: true }),
    supabase.from("staff").select("id, name").eq("is_trainer", true).order("name"),
    supabase.from("consultations").select("id, kind, status, summary, ai_summary, approved, shared, created_at, by_name, flags, duration_min").eq("client_id", params.id).order("created_at", { ascending: false }),
    supabase.from("care_protocols").select("id").eq("client_id", params.id).limit(1),
    // Only issued documents belong in the longitudinal client record. Drafts
    // stay in the dietitian's workspace until they pass clinical review.
    supabase.from("diet_plans").select("id, version, issued_on, published_at, shared_at").eq("client_id", params.id).eq("status", "published").order("version", { ascending: false }),
    supabase.from("diet_assessments").select("id, version, issued_on, published_at, shared_at").eq("client_id", params.id).eq("status", "published").order("version", { ascending: false }),
  ]);
  // Has this client's care journey already been kicked off? If so, the primary
  // "Start" action is done — we only offer a quiet re-run for repairs.
  // care_protocols covers PT/Comprehensive; BluePrint doesn't create one, so its
  // evidence (a blueprints row + blood request) is folded in below via `bp` /
  // `bloodRow` so the button doesn't keep offering "Start journey".
  const hasProtocol = ((protoData ?? []) as unknown[]).length > 0;
  const trainers = (trainerData ?? []) as { id: string; name: string }[];
  const consults = (consultData ?? []) as { id: string; kind: string; status: string; summary: string | null; ai_summary: string | null; approved: boolean; shared: boolean; created_at: string | null; by_name: string | null; flags: { text: string; severity: string }[] | null; duration_min: number | null }[];
  const dietPlans = (dietPlanData ?? []) as { id: string; version: number; issued_on: string | null; published_at: string | null; shared_at: string | null }[];
  const dietAssessments = (dietAssessmentData ?? []) as { id: string; version: number; issued_on: string | null; published_at: string | null; shared_at: string | null }[];

  const me = await getProfile();
  const showPortal = !ro && canWrite(me?.role ?? "");
  const { data: portalProfile } = showPortal
    ? await supabase.from("profiles").select("email").eq("client_id", params.id).eq("role", "Client").maybeSingle()
    : { data: null };

  // Every file once, with one signed URL each. Reports used to be fetched a
  // second time further down and signed twice, then discarded from this list —
  // two round-trips per report on every page load.
  const { data: fileRows } = await supabase
    .from("files").select("id, name, kind, path, bucket, report_label, report_date, summary, created_at")
    .eq("client_id", params.id).order("created_at", { ascending: false });
  const files = await Promise.all(((fileRows ?? []) as { id: string; name: string | null; kind: string; path: string; bucket: string | null; report_label: string | null; report_date: string | null; summary: string | null; created_at: string }[]).map(async (f) => {
    const { data: signed } = await supabase.storage.from(f.bucket || "client-files").createSignedUrl(f.path, 3600);
    return { ...f, url: signed?.signedUrl ?? null };
  }));

  const canMeasure = !ro && (canWrite(me?.role ?? "") || canConsult(me?.role ?? ""));
  const showBilling = canBill(me?.role ?? "");
  const canInvoice = !ro && canManageInvoices(me?.role ?? "");
  const { data: invoiceRows } = showBilling
    ? await supabase.from("invoices").select("id, num, description, amount, status, method, issued_date").eq("client_id", params.id).order("created_at", { ascending: false })
    : { data: [] };
  const invoices = (invoiceRows ?? []) as { id: string; num: number | null; description: string | null; amount: number; status: string; method: string | null; issued_date: string | null }[];
  const { data: measureRows } = await supabase
    .from("measurements").select("*").eq("client_id", params.id).order("date", { ascending: false }).limit(12);
  const measures = (measureRows ?? []) as { id: string; date: string; weight: number | null; bmi: number | null; body_fat: number | null; muscle_mass: number | null; visceral_fat: number | null; waist: number | null; hip: number | null; resting_hr: number | null; recorded_by: string | null }[];
  // True baseline (first-ever record) for the initial-vs-latest comparison.
  const { data: baselineRow } = await supabase
    .from("measurements").select("*").eq("client_id", params.id).order("date", { ascending: true }).limit(1).maybeSingle();

  const canEditFitness = !ro && canWriteFitness(me?.role ?? "");
  const [{ data: habitRows }, { data: habitLogRows }, { data: adherenceRows }, { data: barrierRows }, { data: goalEventRows }, { data: clientGoalOutcomeRows }, { data: programmeLifecycleRow }, { data: programmeLifecycleEventRows }] = await Promise.all([
    supabase.from("habits").select("id, name, icon, cadence, target_per_week, active, cue, time_place, importance, confidence, barrier_code, barrier_detail, if_then_plan, review_date, status").eq("client_id", params.id).order("created_at", { ascending: false }),
    supabase.from("habit_logs").select("habit_id, date").eq("client_id", params.id).eq("done", true),
    supabase.from("coach_adherence_events").select("id, goal_id, category, event_date, outcome, source, note, recorder_name, created_at").eq("client_id", params.id).order("event_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
    supabase.from("coach_barriers").select("id, goal_id, category, detail, coach_response, status, identified_at, resolved_by, resolved_at, resolution_note").eq("client_id", params.id).order("identified_at", { ascending: false }),
    supabase.from("coach_goal_events").select("goal_id, event_type, note, actor_name, created_at").eq("client_id", params.id).order("created_at", { ascending: false }),
    supabase.from("client_goal_outcomes").select("id, goal_id, client_id, goal_name, achievement_rating, progress_note, support_requested, reporter_name, reported_at").eq("client_id", params.id).order("reported_at", { ascending: false }).limit(200),
    supabase.from("coach_programme_lifecycles").select("client_id, status, status_reason, effective_date, next_contact_date, next_contact_plan, changed_by_name, changed_by_role, updated_at").eq("client_id", params.id).maybeSingle(),
    supabase.from("coach_programme_lifecycle_events").select("id, client_id, from_status, to_status, reason, effective_date, next_contact_date, next_contact_plan, actor_name, actor_role, created_at").eq("client_id", params.id).order("effective_date", { ascending: false }).order("created_at", { ascending: false }).limit(200),
  ]);
  const habitBase = (habitRows ?? []) as Omit<CoachingGoalView, "doneDates">[];
  const habitDates = new Map<string, Set<string>>();
  for (const l of ((habitLogRows ?? []) as { habit_id: string; date: string }[])) {
    (habitDates.get(l.habit_id) ?? habitDates.set(l.habit_id, new Set()).get(l.habit_id)!).add(l.date);
  }
  const habToday = todayISO();
  const habits: CoachingGoalView[] = habitBase.map((goal) => ({ ...goal, doneDates: [...(habitDates.get(goal.id) ?? new Set<string>())] }));
  const coachingAdherence = (adherenceRows ?? []) as CoachingAdherenceView[];
  const coachingBarriers = (barrierRows ?? []) as CoachingBarrierView[];
  const coachingGoalEvents = (goalEventRows ?? []) as { goal_id: string; event_type: string; note: string | null; actor_name: string; created_at: string }[];
  const clientGoalOutcomes = (clientGoalOutcomeRows ?? []) as ClientGoalOutcome[];
  const programmeLifecycle = (programmeLifecycleRow ?? null) as CoachProgrammeLifecycle | null;
  const programmeLifecycleEvents = (programmeLifecycleEventRows ?? []) as CoachProgrammeLifecycleEvent[];

  const [
    { data: coachBaselineRow }, { data: coachScreeningRows },
    { data: coachBaselineEventRows }, { data: coachSessionEventRows },
    { data: mdtHuddleRows }, { data: mdtTaskEventRows },
  ] = canConsult(me?.role ?? "")
    ? await Promise.all([
      supabase.from("coach_baselines").select("id, version, status, answers, triggered_pathways, completion_percent, completed_by_name, completed_at, updated_at").eq("client_id", params.id).maybeSingle(),
      supabase.from("coach_assessments").select("id, marker, score, band, tone, date, instrument, instrument_version, interpretation, recommended_action, reviewer_name, next_review_date, source_url").eq("client_id", params.id).order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("coach_baseline_events").select("event_type, percent, pathways, actor_name, created_at").eq("client_id", params.id).order("created_at", { ascending: false }),
      supabase.from("coach_session_events").select("consultation_id, event_type, percent, note, actor_name, created_at").eq("client_id", params.id).order("created_at", { ascending: false }),
      supabase.from("mdt_huddles").select("progress_status, progress_reason, today_owner_role, coach_next_move, author_name, created_at").eq("client_id", params.id).order("created_at", { ascending: false }),
      supabase.from("mdt_task_events").select("to_status, decision, actor_name, created_at, mdt_tasks(task, owner_role)").eq("client_id", params.id).order("created_at", { ascending: false }),
    ])
    : [{ data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const coachBaseline = (coachBaselineRow ?? null) as CoachBaselineView | null;
  const coachScreenings = (coachScreeningRows ?? []) as ScreeningResultView[];
  const coachBaselineEvents = (coachBaselineEventRows ?? []) as { event_type: string; percent: number; pathways: string[]; actor_name: string; created_at: string }[];
  const coachSessionEvents = (coachSessionEventRows ?? []) as { consultation_id: string; event_type: string; percent: number; note: string | null; actor_name: string; created_at: string }[];
  const mdtHuddles = (mdtHuddleRows ?? []) as { progress_status: string; progress_reason: string; today_owner_role: string; coach_next_move: string; author_name: string; created_at: string }[];
  const mdtTaskEvents = (mdtTaskEventRows ?? []) as unknown as { to_status: string; decision: string | null; actor_name: string; created_at: string; mdt_tasks: { task: string; owner_role: string } | null }[];
  const structuredCoachConsults = new Set(coachSessionEvents.map((event) => event.consultation_id));

  const [{ data: wearConns }, { data: wearReads }] = await Promise.all([
    supabase.from("wearable_connections").select("provider, status").eq("client_id", params.id),
    supabase.from("wearable_readings").select("date, steps, resting_hr, sleep_min, active_min, calories, source").eq("client_id", params.id).order("date", { ascending: false }).limit(30),
  ]);
  const connMap: Record<string, string> = {};
  for (const c of ((wearConns ?? []) as { provider: string; status: string }[])) connMap[c.provider] = c.status;
  const reads = (wearReads ?? []) as { date: string; steps: number | null; resting_hr: number | null; sleep_min: number | null; active_min: number | null; calories: number | null; source: string }[];
  const latestRead = reads[0] ?? null;
  const stepTrend = reads.slice(0, 7).reverse(); // oldest→newest of last 7

  const [{ data: clinicalReferralRows }, { data: safetyEventRows }] = canConsult(me?.role ?? "")
    ? await Promise.all([
      supabase.from("clinical_referrals")
        .select("id, reason, destination_role, urgency, requested_action, consent_status, assigned_to_staff_id, status, created_by, created_by_name, created_at, updated_at")
        .eq("client_id", params.id).order("created_at", { ascending: false }),
      supabase.from("safety_events")
        .select("id, trigger_type, concern_summary, immediate_action, recipient_role, status, opened_by_name, opened_at, acknowledged_by, acknowledged_at, resolved_by, resolved_at, resolution_note")
        .eq("client_id", params.id).order("opened_at", { ascending: false }),
    ])
    : [{ data: [] }, { data: [] }];
  const clinicalReferrals = (clinicalReferralRows ?? []) as ClinicalReferralView[];
  const safetyEvents = (safetyEventRows ?? []) as SafetyEventView[];
  const referralIds = clinicalReferrals.map((x) => x.id);
  const safetyEventIds = safetyEvents.map((x) => x.id);
  const [{ data: clinicalReferralEventRows }, { data: safetyEventActionRows }] = await Promise.all([
    referralIds.length
      ? supabase.from("clinical_referral_events")
        .select("referral_id, from_status, to_status, note, actor_name, created_at")
        .in("referral_id", referralIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    safetyEventIds.length
      ? supabase.from("safety_event_actions")
        .select("event_id, action_type, note, actor_name, created_at")
        .in("event_id", safetyEventIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const clinicalReferralEvents = (clinicalReferralEventRows ?? []) as {
    referral_id: string; from_status: string | null; to_status: string;
    note: string | null; actor_name: string; created_at: string;
  }[];
  const safetyEventActions = (safetyEventActionRows ?? []) as {
    event_id: string; action_type: string; note: string | null;
    actor_name: string; created_at: string;
  }[];

  const { data: cwData } = await supabase.from("client_workouts").select("id, name, mode, type, items, assigned_by, created_at").eq("client_id", params.id).order("created_at", { ascending: false });
  // Prescriptions rendered only on the EMR chart before this — invisible on the
  // client's own card, which is where front desk and coaches actually look.
  // The clinical record in brief. The full chart lives at /emr/[id]; this is
  // the "is there anything I must know" view — allergies first, because that is
  // the one thing that changes what anyone does next.
  // Match the gate to the RLS behind it. `canConsult || canWrite` included Front
  // Desk and every discipline, but the policies on problems/medications/
  // prescriptions/orders are `is_admin() or Doctor` — so those roles were shown
  // a Medical record card that could only ever say "None recorded". A card that
  // exists to display nothing is worse than no card: it reads as "this client
  // has no problems", which is a clinical claim we have not earned.
  const canEmrRead = canEmr(me?.role ?? "");




  const [emrAllergiesR, emrProblemsR, emrMedsR, emrOrdersR] = canEmrRead ? await Promise.all([
    supabase.from("allergies").select("substance, severity").eq("client_id", params.id),
    supabase.from("problems").select("description, status").eq("client_id", params.id).eq("status", "active").limit(12),
    supabase.from("medications").select("name, dose, frequency").eq("client_id", params.id).eq("status", "active").limit(12),
    supabase.from("orders").select("test, status, priority, created_at").eq("client_id", params.id).order("created_at", { ascending: false }).limit(8),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const emrAllergies = (emrAllergiesR.data ?? []) as { substance: string; severity: string }[];
  const emrProblems = (emrProblemsR.data ?? []) as { description: string; status: string }[];
  const emrMeds = (emrMedsR.data ?? []) as { name: string; dose: string | null; frequency: string | null }[];
  const emrOrders = (emrOrdersR.data ?? []) as { test: string; status: string; priority: string | null; created_at: string }[];

  const { data: rxData } = await supabase.from("prescriptions")
    .select("id, status, provider, signed_date, shared_at, consultation_id, prescription_items(drug, dose, frequency, duration)")
    .eq("client_id", params.id).order("created_at", { ascending: false }).limit(5);
  // null for any client not on an active Comprehensive package — the panel
  // simply doesn't render for them.
  const compView = await getComprehensiveView(params.id);
  const pkgStatus = await getPackageStatus(params.id);
  const ptView = await getPTView(params.id);
  // Service catalogue — lets the protocol boards' "Book →" pre-fill the exact
  // milestone service, not just the discipline.
  const { data: svcRows } = await supabase.from("services").select("name, category, day_offset");
  const bookServices = (svcRows ?? []) as { name: string; category: string; day_offset: number | null }[];
  const prescriptions = (rxData ?? []) as unknown as {
    id: string; status: string; provider: string | null; signed_date: string | null; shared_at: string | null; consultation_id: string | null;
    prescription_items: { drug: string; dose: string | null; frequency: string | null; duration: string | null }[];
  }[];

  // What each consultation produced. Since 0120 a prescription and a lab order
  // record the consultation they came out of, so a session can show its own
  // documents instead of the reader guessing which Rx belongs to which visit.
  const rxByConsult = new Map<string, { id: string; shared_at: string | null }>();
  for (const rx of prescriptions as unknown as { id: string; consultation_id?: string | null; shared_at: string | null }[]) {
    if (rx.consultation_id && !rxByConsult.has(rx.consultation_id)) rxByConsult.set(rx.consultation_id, { id: rx.id, shared_at: rx.shared_at });
  }
  const looseRx = (prescriptions as unknown as { id: string; consultation_id?: string | null; shared_at: string | null; signed_date: string | null; provider: string | null }[])
    .filter((rx) => !rx.consultation_id);
  const { data: ordRows } = await supabase.from("orders")
    .select("consultation_id, status").eq("client_id", params.id).neq("status", "cancelled");
  const ordersByConsult = new Map<string, { total: number; resulted: number }>();
  for (const o of ((ordRows ?? []) as { consultation_id: string | null; status: string }[])) {
    if (!o.consultation_id) continue;
    const cur = ordersByConsult.get(o.consultation_id) ?? { total: 0, resulted: 0 };
    cur.total += 1; if (o.status === "resulted") cur.resulted += 1;
    ordersByConsult.set(o.consultation_id, cur);
  }
  const workouts = (cwData ?? []) as unknown as { id: string; name: string; mode: string; type: string; items: { exercise: string; sets?: string; reps?: string; rest?: string }[]; assigned_by: string | null; created_at: string }[];

  // owner / coach names, blueprint status, onboarding journey follow-ups, packages held
  const [{ data: staffAll }, { data: bpRow }, { data: fuRows }, { data: cpRows }, { data: allPkgs }, { data: assignRows }, { data: bloodRows }, { data: signoffRows }] = await Promise.all([
    supabase.from("staff").select("id, name"),
    supabase.from("blueprints").select("generated, generated_date, scores").eq("client_id", params.id).maybeSingle(),
    supabase.from("followups").select("label, due_date, status, kind").eq("client_id", params.id).order("due_date"),
    supabase.from("client_packages").select("id, package_id, package_name, category, start_date, end_date, price, status").eq("client_id", params.id).order("start_date", { ascending: false }),
    supabase.from("packages").select("id, name, price, is_facility").eq("active", true).order("price"),
    supabase.from("client_assignments").select("discipline, staff_id").eq("client_id", params.id),
    supabase.from("blood_requests").select("requested_at, submitted, submitted_date, panel").eq("client_id", params.id),
    supabase.from("blueprint_signoffs").select("discipline").eq("client_id", params.id),
  ]);
  const staffMap = new Map(((staffAll ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  const ownerName = c0.owner ? (staffMap.get(String(c0.owner)) ?? null) : null;
  // The Health Coach is the coach-discipline care-team member — NOT clients.pro_id,
  // which is the denormalised primary pro (doctor-first) and would mislabel the
  // doctor as the coach.
  const assignByDisc = new Map(((assignRows ?? []) as { discipline: string; staff_id: string | null }[]).map((r) => [r.discipline, r.staff_id]));
  const coachId = assignByDisc.get("coach");
  const coachName = coachId ? (staffMap.get(String(coachId)) ?? null) : null;
  const coachSupervisorOverride = isHealthCoachSupervisor(me?.role ?? "");
  const assignedCoachCanManage = me?.role === "Health Coach" && Boolean(me.staffId)
    && coachId === me.staffId;
  const canManageCoaching = !ro && (assignedCoachCanManage || coachSupervisorOverride);
  // The full care team assigned to this client, per discipline, in a stable order.
  const CT_LABEL: Record<string, string> = { doctor: "Doctor", dietitian: "Dietitian", trainer: "Fitness Trainer", coach: "Health Coach", psychologist: "Psychologist" };
  const careTeam = ["doctor", "dietitian", "trainer", "coach", "psychologist"]
    .map((d) => ({ disc: CT_LABEL[d], name: assignByDisc.get(d) ? (staffMap.get(String(assignByDisc.get(d))) ?? null) : null }))
    .filter((x) => x.name) as { disc: string; name: string }[];
  const bp = (bpRow ?? null) as { generated: boolean; generated_date: string | null; scores: Record<string, number> | null } | null;
  // BluePrint consolidated sign-off progress: who's assigned (required) and
  // who's signed. Shown as a "required sign-offs" line so front desk sees who's
  // still pending before the Blueprint can generate.
  const bpRequired = ((assignRows ?? []) as { discipline: string }[]).map((r) => r.discipline).filter((d) => (DISCIPLINES as readonly string[]).includes(d));
  const bpSigned = new Set(((signoffRows ?? []) as { discipline: string }[]).map((r) => r.discipline));
  const followups = (fuRows ?? []) as { label: string; due_date: string; status: string; kind: string }[];
  const clientPackages = (cpRows ?? []) as { id: string; package_id: string | null; package_name: string | null; category: string; start_date: string | null; end_date: string | null; price: number | null; status: string }[];
  const pkgList = (allPkgs ?? []) as { id: string; name: string; price: number; is_facility: boolean }[];
  // A client's membership can live in either place: the newer client_packages
  // table, or the legacy single `package_id` on the client record (surfaced as
  // client.packages). Count both, so a client whose only membership is the
  // legacy facility package isn't wrongly shown as "no active membership" —
  // which would also block PT/Comprehensive sales. The 0089 backfill copies
  // legacy packages into client_packages; this fallback covers anything not yet
  // migrated and stays correct afterwards.
  const legacyFacilityMembership = Boolean((client as { packages: { is_facility: boolean } | null }).packages?.is_facility);
  // Voided packages are still rendered (struck-through, for the audit trail) but
  // must not count towards any obligation, control or membership check — so all
  // the derived flags run off heldPackages, never the raw list.
  const heldPackages = clientPackages.filter((r) => r.status !== "void");
  // Void a wrongly-added package — Admin / Manager only, and never in read-only.
  const canVoidPackages = !ro && canVoidPackage(me?.role ?? "");
  const activeMembership = legacyFacilityMembership
    || heldPackages.some((r) => r.category === "membership" && r.status === "active" && (!r.end_date || r.end_date >= todayISO()) && (!r.start_date || r.start_date <= todayISO()));
  // Does this client hold a package whose care journey should have been kicked
  // off (booking tasks, blood request, care team)? Used to offer the repair.
  const hasJourneyPkg = heldPackages.some((r) => ["blueprint", "training", "comprehensive"].includes(r.category));
  // BluePrint is a STANDALONE package — it is not part of Comprehensive.
  // Comprehensive has its own blood panel and consults, but never produces a
  // BluePrint report, so the BluePrint card must not appear on a Comprehensive
  // client (it used to render for everyone, showing a misleading
  // "Pending · required sign-offs 0/3" against a report nobody owes).
  // A delivered report still shows for a client who once bought BluePrint, so
  // history is never hidden.
  const holdsBlueprint = heldPackages.some((r) => r.category === "blueprint");
  const showBlueprint = holdsBlueprint || Boolean(bp?.generated);
  // Membership controls (front-desk supervised): shown for any client who holds
  // a membership — active or lapsed — so it can be renewed. Default the renew
  // dropdown to the current membership's package.
  const holdsMembership = legacyFacilityMembership || heldPackages.some((r) => r.category === "membership");
  const currentMembershipPkgId = heldPackages.find((r) => r.category === "membership" && r.status === "active")?.package_id
    ?? heldPackages.find((r) => r.category === "membership")?.package_id ?? null;
  // The single renewal entry point covers any renewable (fixed-term) package —
  // membership, PT (training) or Comprehensive. BluePrint is one-off (Add package).
  const RENEWABLE_CATS = ["membership", "training", "comprehensive"];
  const renewablePackages = pkgList.filter((pk) => RENEWABLE_CATS.includes(packageCategory(pk.id, pk.is_facility)));
  const holdsRenewable = legacyFacilityMembership || heldPackages.some((r) => RENEWABLE_CATS.includes(r.category));
  const currentRenewablePkgId =
    heldPackages.find((r) => RENEWABLE_CATS.includes(r.category) && r.status === "active")?.package_id
    ?? heldPackages.find((r) => RENEWABLE_CATS.includes(r.category))?.package_id
    ?? currentMembershipPkgId;
  const isFrozen = Boolean(c0.frozen);
  // PT / Comprehensive strength sessions: offer guided scheduling until booked.
  const isPtOrComp = heldPackages.some((r) => ["training", "comprehensive"].includes(r.category));
  const hasScheduledSessions = ((sessions ?? []) as { status: string }[]).some((s) => s.status === "scheduled");
  const assignedTrainerId = assignByDisc.get("trainer") ?? null;
  // Role-aware status badge (same value shown everywhere this client appears).
  const detailStatus = clientStatus((await loadClientStatuses(supabase, [params.id], todayISO())).get(params.id), disciplineForRole(me?.role));
  // Blood report status — shown prominently for BluePrint / Comprehensive
  // clients (whose journey requests a panel). One row per client; take the first.
  const bloodRowsAll = ((bloodRows ?? []) as { requested_at: string | null; submitted: boolean; submitted_date: string | null; panel: string | null }[]);
  const bloodRow = bloodRowsAll[0] ?? null;
  // A client can hold two panels at once (BluePrint + Comprehensive). Show each
  // that either the packages call for or a row already exists for, so front desk
  // can request / mark-received the right one.
  const BLOOD_PANEL_LABEL: Record<string, string> = { blueprint: "BluePrint panel", comprehensive: "Comprehensive panel" };
  const bloodByPanel = new Map(bloodRowsAll.map((r) => [r.panel ?? "blueprint", r]));
  const bloodPanels = Array.from(new Set([
    ...heldPackages.filter((r) => ["blueprint", "comprehensive"].includes(r.category)).map((r) => r.category),
    ...bloodRowsAll.map((r) => r.panel ?? "blueprint"),
  ]));
  const needsBlood = bloodPanels.length > 0;
  // Journey is live if the protocol exists (PT/Comprehensive) or BluePrint's
  // artefacts do (blueprints row / blood request). Keeps the Start-journey button
  // from re-appearing after it's already been run.
  const journeyStarted = hasProtocol || Boolean(bp) || Boolean(bloodRow);
  const clientAge = ageOf(c0.dob);

  // Health profile headline metrics. Latest measurement wins; the client's
  // profile height/weight is the fallback, since a client with no InBody yet
  // still has the figures front desk took at sign-up.
  const latestMeasure = (measures[0] ?? null) as (typeof measures)[number] | null;
  const num = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${v}${unit}`);
  const female = String(client.gender ?? "").trim().toLowerCase().startsWith("f");
  // Only two tiles carry a judgement, and only where the reference is
  // uncontroversial: visceral fat above 9, and body fat above the usual band.
  const fatHigh = latestMeasure?.body_fat != null && latestMeasure.body_fat > (female ? 32 : 25);
  const viscHigh = (latestMeasure?.visceral_fat ?? 0) > 9;
  const healthMetrics: { label: string; value: string; note?: string; tone?: string }[] = [
    { label: "Age / Sex", value: [clientAge != null ? `${clientAge}` : "—", client.gender ?? ""].filter(Boolean).join(" · ") },
    { label: "Height", value: num(client.height as number | null, " cm") },
    { label: "Weight", value: num((latestMeasure?.weight ?? (client.weight as number | null)), " kg") },
    { label: "BMI", value: num(latestMeasure?.bmi) },
    { label: "Body fat", value: num(latestMeasure?.body_fat, "%"), tone: fatHigh ? "var(--amber-text)" : undefined },
    { label: "Muscle", value: num(latestMeasure?.muscle_mass, " kg") },
    { label: "Visceral", value: num(latestMeasure?.visceral_fat), note: viscHigh ? "above 9" : undefined, tone: viscHigh ? "var(--amber-text)" : undefined },
    { label: "Waist / Hip", value: latestMeasure?.waist || latestMeasure?.hip ? `${num(latestMeasure?.waist)} / ${num(latestMeasure?.hip)}` : "—" },
  ];


  const pkg = (client as { packages: { name: string; sessions: number; is_facility: boolean; price: number } | null }).packages;
  const sess = (sessions ?? []) as {
    id: string; seq: number; date: string; hour: number; status: string; rescheduled: boolean;
    trainer_id: string; staff: { name: string } | null;
  }[];
  const done = sess.filter((s) => s.status === "completed").length;
  const referralById = new Map(clinicalReferrals.map((x) => [x.id, x]));
  const safetyById = new Map(safetyEvents.map((x) => [x.id, x]));

  // One activity stream. Assembled from rows the page already fetches, so it
  // costs nothing extra — the data was always here, it was just displayed as
  // six independently-sorted tables.
  const activity: TimelineEvent[] = buildTimeline([
    // Package purchases — where the journey begins.
    clientPackages.filter((c) => c.status !== "void").map((c) => ({
      at: atDay(c.start_date) ?? "", kind: "package" as const,
      title: `${c.package_name ?? c.category} purchased`, detail: c.category,
    })),
    // Sessions are deliberately NOT listed here: the full Strength Sessions
    // table sits directly below on this same tab, so every session appeared
    // twice, and a 24-session block drowned out everything else in the journey.
    // A single summarising event keeps the block visible in the story.
    sess.length
      ? [{
          at: atDay(sess[0].date) ?? "", kind: "session" as const,
          title: `Strength block — ${sess.length} session${sess.length === 1 ? "" : "s"}`,
          detail: `${sess.filter((x) => x.status === "done").length} done · see the table below`,
          pending: sess.some((x) => x.status === "scheduled"),
        }]
      : [],
    consults.filter((c) => !structuredCoachConsults.has(c.id)).map((c) => ({
      at: atDay(c.created_at) ?? "", kind: "consultation" as const,
      title: `${c.kind} consultation`, detail: c.status,
      pending: c.status !== "completed",
    })),
    invoices.map((i) => ({
      at: atDay(i.issued_date) ?? "", kind: "invoice" as const,
      title: `${i.description ?? "Invoice"} — ₹${Number(i.amount).toLocaleString("en-IN")}`,
      detail: i.status, pending: i.status === "Unpaid",
    })),
    prescriptions.map((r) => ({
      at: atDay(r.signed_date) ?? "", kind: "note" as const,
      title: "Prescription issued",
      detail: r.shared_at ? "in client portal" : "not yet shared",
      pending: !r.shared_at,
    })),
    workouts.map((w) => ({
      at: w.created_at, kind: "note" as const,
      title: `Workout assigned — ${w.name}`, by: w.assigned_by,
    })),
    clinicalReferralEvents.map((event) => {
      const referral = referralById.get(event.referral_id);
      const destination = referral?.destination_role ?? "care team";
      return {
        at: event.created_at, kind: "concern" as const,
        title: `Clinical referral ${event.to_status.toLowerCase()} — ${destination}`,
        detail: event.note ?? referral?.reason ?? null,
        by: event.actor_name,
        href: `/clients/${params.id}?tab=overview#care-coordination`,
      };
    }),
    safetyEventActions.map((action) => {
      const event = safetyById.get(action.event_id);
      const verb = action.action_type === "Created" ? "opened" : action.action_type.toLowerCase();
      return {
        at: action.created_at, kind: "concern" as const,
        title: `Safety concern ${verb}${event ? ` — ${event.trigger_type}` : ""}`,
        detail: action.note,
        by: action.actor_name,
        href: `/clients/${params.id}?tab=overview#care-coordination`,
      };
    }),
    coachingGoalEvents.map((event) => ({
      at: event.created_at, kind: "note" as const,
      title: `Coaching goal ${event.event_type.toLowerCase()}`,
      detail: event.note, by: event.actor_name,
      href: `/clients/${params.id}?tab=overview#coaching-goals`,
    })),
    coachBaselineEvents.map((event) => ({
      at: event.created_at, kind: "note" as const,
      title: `Health Coach baseline ${event.event_type.toLowerCase()} — ${event.percent}%`,
      detail: event.pathways.length ? `${event.pathways.length} pathway${event.pathways.length === 1 ? "" : "s"} opened` : null,
      by: event.actor_name,
      href: `/clients/${params.id}?tab=overview#coach-baseline`,
      pending: event.percent < 100,
    })),
    coachScreenings.map((screening) => ({
      at: atDay(screening.date) ?? "", kind: screening.tone === "bad" ? "concern" as const : "note" as const,
      title: `${screening.instrument ?? screening.marker} screening — ${screening.interpretation ?? screening.band ?? "recorded"}`,
      detail: `Score ${screening.score}${screening.recommended_action ? ` · ${screening.recommended_action}` : ""}`,
      by: screening.reviewer_name,
      href: `/clients/${params.id}?tab=overview#coach-baseline`,
      pending: screening.tone === "bad",
    })),
    coachSessionEvents.filter((event) => event.event_type !== "Saved").map((event) => ({
      at: event.created_at, kind: "consultation" as const,
      title: `Health Coach session ${event.event_type.toLowerCase()} — ${event.percent}%`,
      detail: event.note, by: event.actor_name,
      href: `/console/${event.consultation_id}`,
      pending: event.event_type !== "Completed",
    })),
    mdtHuddles.map((huddle) => ({
      at: huddle.created_at, kind: huddle.progress_status === "Red" ? "concern" as const : "note" as const,
      title: `MDT huddle — ${huddle.progress_status.toLowerCase()} · owner ${huddle.today_owner_role}`,
      detail: `${huddle.progress_reason} · Coach next: ${huddle.coach_next_move}`,
      by: huddle.author_name,
      href: "/workspace?tab=board",
      pending: huddle.progress_status === "Red",
    })),
    mdtTaskEvents.map((event) => ({
      at: event.created_at, kind: "task" as const,
      title: `MDT action ${event.to_status.toLowerCase()} — ${event.mdt_tasks?.task ?? "team action"}`,
      detail: event.decision ?? `Owned by ${event.mdt_tasks?.owner_role ?? "care team"}`,
      by: event.actor_name,
      href: "/workspace?tab=board",
      pending: !["Completed", "Cancelled"].includes(event.to_status),
    })),
    coachingAdherence.map((event) => ({
      at: atDay(event.event_date) ?? "", kind: "task" as const,
      title: `${event.category} — ${event.outcome.toLowerCase()}`,
      detail: event.note, by: event.recorder_name,
      href: `/clients/${params.id}?tab=overview#coaching-goals`,
      pending: event.outcome === "Missed",
    })),
    coachingBarriers.flatMap((barrier) => {
      const rows: TimelineEvent[] = [{
        at: barrier.identified_at, kind: "concern" as const,
        title: `Coaching barrier recorded — ${barrier.category}`,
        detail: barrier.detail,
        href: `/clients/${params.id}?tab=overview#coaching-goals`,
        pending: barrier.status !== "Resolved",
      }];
      if (barrier.resolved_at) rows.push({
        at: barrier.resolved_at, kind: "note" as const,
        title: `Coaching barrier resolved — ${barrier.category}`,
        detail: barrier.resolution_note, by: barrier.resolved_by,
        href: `/clients/${params.id}?tab=overview#coaching-goals`,
      });
      return rows;
    }),
    // Blood report — requested, then received.
    bloodRowsAll.flatMap((b) => {
      const panel = b.panel === "comprehensive" ? "Comprehensive" : "BluePrint";
      const evs: (TimelineEvent | null)[] = [
        b.requested_at ? { at: atDay(b.requested_at) ?? "", kind: "note" as const, title: `Blood report requested`, detail: `${panel} panel`, pending: !b.submitted } : null,
      ];
      if (b.submitted && b.submitted_date) evs.push({ at: atDay(b.submitted_date) ?? "", kind: "note" as const, title: "Blood report received", detail: `${panel} panel` });
      return evs;
    }),
    // BluePrint generated.
    bp?.generated && bp.generated_date ? [{ at: atDay(bp.generated_date) ?? "", kind: "note" as const, title: "BluePrint generated", detail: "PHB ready" }] : [],
    // Onboarding milestones (dated follow-ups).
    followups.filter((f) => f.kind === "onboarding").map((f) => ({
      at: atDay(f.due_date) ?? "", kind: "task" as const,
      title: f.label, detail: "onboarding milestone", pending: f.status !== "done",
    })),
  ]);

  // (Client-journey milestone checklist removed — its completed steps now
  // interleave into the chronological feed above, and what's still pending
  // lives on the Overview "Open now / Upcoming" tracker.)


  // Consultations grouped by the service they are, newest first inside each.
  // "What has the doctor done for this client" is the question people actually
  // arrive with; a strict date order interleaved five disciplines and answered
  // it only by scanning.
  // What a session IS, not just which discipline ran it. The first of a
  // discipline is the intake; the rest are follow-ups, numbered as a clinician
  // would count them. Derived from order rather than from the booked milestone:
  // the milestone match (day-10 vs day-21) needs the appointment and the package
  // start date, which is the console's job — this stays true even for a session
  // booked ad hoc or backdated.
  const sessionSeq = new Map<string, number>();
  for (const kind of ["Doctor", "Diet", "Trainer", "Coach", "Psychologist"]) {
    consults
      .filter((c) => c.kind === kind)
      .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))
      .forEach((c, i) => sessionSeq.set(c.id, i + 1));
  }
  const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 - 20) % 10] ?? ["th", "st", "nd", "rd"][n % 100] ?? "th"}`;
  const sessionName = (kind: string, id: string) => {
    const n = sessionSeq.get(id) ?? 1;
    const noun = SESSION_NOUN[kind] ?? "consultation";
    return n === 1 ? `Initial ${noun}` : `${noun[0].toUpperCase()}${noun.slice(1)} follow-up · ${ordinal(n)} visit`;
  };

  const SERVICE_ORDER = ["Doctor", "Diet", "Trainer", "Coach", "Psychologist"] as const;
  const consultsByService = SERVICE_ORDER
    .map((kind) => ({
      kind,
      label: SERVICE_NAME[kind] ?? kind,
      // Whoever the care team assigned to this discipline — the clinician
      // responsible, as opposed to consultations.by_name which only records
      // who opened the session.
      clinician: (() => {
        const staffId = assignByDisc.get(SERVICE_DISCIPLINE[kind]);
        return staffId ? (staffMap.get(String(staffId)) ?? null) : null;
      })(),
      rows: consults
        .filter((c) => c.kind === kind)
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))),
    }))
    .filter((g) => g.rows.length > 0);

  // The clinical reports, taken from the files already loaded above.
  // `report_date` is the date on the document; created_at is only when it was
  // filed, so it is the fallback when reading a trend.
  const reportFiles = files
    .filter((f) => REPORT_KINDS_SET.has(f.kind))
    .map((f) => ({ ...f, on: f.report_date ?? f.created_at }))
    .sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));

  // Grouped by month so a long history reads as a timeline instead of 40 rows.
  const reportMonths: { key: string; label: string; rows: typeof reportFiles }[] = [];
  for (const r of reportFiles) {
    const d = new Date(r.on.length <= 10 ? `${r.on}T00:00:00Z` : r.on);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    const last = reportMonths[reportMonths.length - 1];
    if (last?.key === key) last.rows.push(r); else reportMonths.push({ key, label, rows: [r] });
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/clients" style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none" }}>
        ← Clients
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 18px" }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: "50%", background: "var(--brand-fill)",
            color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16,
          }}
        >
          {client.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <RealtimeRefresh tables={["sessions","consultations","files","measurements","meal_logs","invoices","habits","habit_logs","coach_goal_events","coach_adherence_events","coach_barriers","client_goal_outcomes","coach_programme_lifecycles","coach_programme_lifecycle_events","coach_baselines","coach_baseline_events","coach_assessments","coach_session_workflows","coach_session_events","wearable_readings","wearable_connections","client_workouts","prescriptions","blood_requests","client_packages","client_assignments","clinical_referrals","safety_events"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>{client.name}</h1>
            <ClientStatusBadge status={detailStatus} />
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {client.code} · {pkg?.name ?? "—"} · joined {client.joined ?? "—"}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {/* Editing client details is front-desk work (canWrite = Super Admin /
            Administrator / Manager / Front Desk). Clinicians read the card but
            don't own the record, so they get no Edit button — previously this
            was gated only on the read-only preview flag, so every clinician saw
            an Edit button that led to a form the server action would refuse. */}
        {ro
          ? <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700 }}>Read-only</span>
          : canWrite(me?.role ?? "")
            ? <Link
                href={`/clients/${params.id}/edit`}
                style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--ink)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
              >
                Edit
              </Link>
            : null}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <SegTabs active={tab} items={[
          { key: "overview", label: "Overview", href: `/clients/${params.id}?tab=overview${ro ? "&ro=1" : ""}` },
          { key: "timeline", label: "Service timeline", href: `/clients/${params.id}?tab=timeline${ro ? "&ro=1" : ""}` },
          { key: "card", label: "Client card", href: `/clients/${params.id}?tab=card${ro ? "&ro=1" : ""}` },
        ]} />
      </div>

      {canConsult(me?.role ?? "") && safetyEvents.some((event) => event.status !== "Resolved") && (
        <HealthCoachCarePanel
          clientId={params.id}
          referrals={clinicalReferrals}
          safetyEvents={safetyEvents}
          role={me?.role ?? ""}
          userId={me?.id ?? ""}
          staffId={me?.staffId ?? null}
          readOnly={ro}
          showPanel={false}
          coachCanManage={canManageCoaching}
        />
      )}

      {tab === "overview" && (<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Start with the work that needs action today, before background records. */}
      {pkgStatus && (pkgStatus.openNow.length > 0 || pkgStatus.upcoming.length > 0) && (
        <div style={{ order: 1 }}><PackageStatusPanel openNow={pkgStatus.openNow} upcoming={pkgStatus.upcoming} clientId={params.id} canChase={!ro && isBillingOverseer(me?.role ?? "")} viewerStaffId={me?.staffId ?? null} /></div>
      )}

      <div style={{ order: 5 }}>
      {canConsult(me?.role ?? "") && (
        <div style={{ marginBottom: 16 }}>
          <HealthCoachCarePanel
            clientId={params.id}
            referrals={clinicalReferrals}
            safetyEvents={safetyEvents}
            role={me?.role ?? ""}
            userId={me?.id ?? ""}
            staffId={me?.staffId ?? null}
            readOnly={ro}
            showOpenSafety={false}
            prefillReferralRole={searchParams.referral}
            prefillReferralReason={searchParams.referral_reason}
            coachCanManage={canManageCoaching}
          />
        </div>
      )}

      {canManageCoaching && (
        <CoachProgrammeLifecyclePanel
          clientId={params.id}
          lifecycle={programmeLifecycle}
          events={programmeLifecycleEvents}
          canManage={canManageCoaching}
          supervisorOverride={coachSupervisorOverride}
          today={habToday}
        />
      )}

      {canManageCoaching && (
        <HealthCoachGoalsPanel
          clientId={params.id}
          goals={habits}
          events={coachingAdherence}
          barriers={coachingBarriers}
          outcomes={clientGoalOutcomes}
          canManage={canManageCoaching}
          today={habToday}
          supervisorOverride={coachSupervisorOverride}
        />
      )}

      {canManageCoaching && (
        <HealthCoachBaselinePanel
          clientId={params.id}
          baseline={coachBaseline}
          screenings={coachScreenings}
          canManage={canManageCoaching}
          gender={client.gender}
          supervisorOverride={coachSupervisorOverride}
        />
      )}

      {canConsult(me?.role ?? "") && !canManageCoaching && (
        <CoachingSummary
          lifecycle={programmeLifecycle}
          baselinePercent={coachBaseline?.completion_percent ?? 0}
          goals={habits}
          events={coachingAdherence}
          barriers={coachingBarriers}
        />
      )}
      </div>

      {/* ---- The people coordinating the work ---- */}
      <div style={{ order: 4, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Care Team</div>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>· assigned Health Professionals</span>
        </div>
        {careTeam.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {careTeam.map((m) => (
              <div key={m.disc} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", minWidth: 150 }}>
                <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" }}>{m.disc}</div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No Health Professionals assigned yet.</div>}
      </div>

      {/* ---- Package and finance records ---- */}
      {/* Packages */}
      <div style={{ order: 3, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Packages</div>
          <span style={{ background: activeMembership ? "var(--green-bg)" : "var(--amber-bg)", color: activeMembership ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
            {activeMembership ? "✔ Active membership" : "No active membership"}
          </span>
          {isFrozen && <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>⏸ Paused since {String(c0.frozen).slice(0, 10)}</span>}
        </div>

        {/* Packages held (membership + PT + …) */}
        {clientPackages.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Package</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Type</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Valid</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Price</th>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Status</th>
                {canVoidPackages && <th style={{ textAlign: "right", padding: "4px 6px" }}></th>}
              </tr>
            </thead>
            <tbody>
              {clientPackages.map((cp) => {
                const voided = cp.status === "void";
                const live = cp.status === "active" && (!cp.end_date || cp.end_date >= todayISO());
                return (
                  <tr key={cp.id} style={{ borderTop: "1px solid var(--border)", opacity: voided ? 0.55 : 1 }}>
                    <td style={{ padding: "8px 6px", fontWeight: 600, textDecoration: voided ? "line-through" : "none" }}>{cp.package_name ?? "—"}</td>
                    <td style={{ padding: "8px 6px" }}><span style={{ background: cp.category === "membership" ? "var(--blue-bg)" : "var(--brand-tint)", color: cp.category === "membership" ? "var(--blue-text)" : "var(--brand-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{cp.category}</span></td>
                    <td style={{ padding: "8px 6px", color: "var(--muted)" }}>{cp.start_date ?? "—"}{cp.end_date ? ` → ${cp.end_date}` : ""}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>₹{Number(cp.price ?? 0).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "8px 6px" }}><span style={{ background: voided ? "var(--red-bg)" : live ? "var(--green-bg)" : "var(--neutral-bg)", color: voided ? "var(--red-text)" : live ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{voided ? "Removed" : live ? "Active" : "Expired"}</span></td>
                    {canVoidPackages && <td style={{ padding: "8px 6px", textAlign: "right" }}>{!voided && <VoidPackageButton clientId={params.id} packageRowId={cp.id} packageName={cp.package_name ?? "this package"} />}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 12 }}>
            <Stat label="Package" value={pkg?.name ?? "—"} />
            <Stat label="Price" value={pkg ? `₹${Number(pkg.price ?? 0).toLocaleString("en-IN")}` : "—"} />
            <Stat label="Joined" value={client.joined} />
            <Stat label="Status" value={<span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>Active</span>} />
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!ro && canBill(me?.role ?? "") && <AddPackage clientId={params.id} packages={pkgList} hasMembership={activeMembership} />}
          {!ro && canBill(me?.role ?? "") && holdsRenewable && <RenewMembership clientId={params.id} packages={renewablePackages} currentPackageId={currentRenewablePkgId} />}
          {!ro && canWrite(me?.role ?? "") && holdsMembership && <FreezeToggle clientId={params.id} frozen={isFrozen} />}
          {!ro && canWrite(me?.role ?? "") && isPtOrComp && !hasScheduledSessions && <ScheduleSessionsForm clientId={params.id} trainers={trainers} defaultTrainerId={assignedTrainerId} />}
          {!ro && canWrite(me?.role ?? "") && hasJourneyPkg && <RepairJourneyButton clientId={params.id} started={journeyStarted} />}
        </div>
      </div>


      {/* Billing — what they owe and what they have paid. Split out of the
          packages card: what a client bought and what they have been invoiced
          are answered by different people on different days. */}
      {showBilling && (invoices.length > 0 || canInvoice) && (
        <div style={{ order: 3, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Billing</div>
            {invoices.length > 0 && (
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                · {invoices.filter((i) => i.status !== "Paid").length} unpaid of {invoices.length}
              </span>
            )}
          </div>
          {invoices.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No invoices raised yet.</div>}
          {invoices.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, borderTop: "1px solid var(--border)" }}>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 6px", color: "var(--muted)" }}>INV-{String(i.num ?? 0).padStart(3, "0")}</td>
                    <td style={{ padding: "8px 6px" }}>{i.description}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>₹{Number(i.amount).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "8px 6px" }}><span style={{ background: i.status === "Paid" ? "var(--green-bg)" : i.status === "Unpaid" ? "var(--amber-bg)" : "var(--neutral-bg)", color: i.status === "Paid" ? "var(--green-text)" : i.status === "Unpaid" ? "var(--amber-text)" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{i.status}</span></td>
                    <td style={{ padding: "8px 6px", textAlign: "right" }}>{canInvoice && <InvoiceActions id={i.id} status={i.status} role={me?.role ?? ""} clientId={params.id} label={`INV-${String(i.num ?? 0).padStart(3, "0")} · ₹${Number(i.amount).toLocaleString("en-IN")}`} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {canInvoice && <div style={{ marginTop: 10 }}><InvoiceForm clientId={params.id} /></div>}
        </div>
      )}

      {/* Client details — contact and identity. Height/weight used to sit here
          as well, but the profile figures are whatever was typed at sign-up;
          the measured ones live in Health profile and would contradict these
          the moment anyone stepped on a scale. Coach and owner moved to Care
          Team, where assignments belong. */}
      <div style={{ order: 2, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Client details</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Stat label="Phone" value={client.phone} />
          <Stat label="Email" value={client.email} />
          <Stat label="Age" value={clientAge != null ? `${clientAge} yrs` : "—"} />
          <Stat label="Gender" value={client.gender} />
          <Stat label="Occupation" value={client.occupation} />
          <Stat label="Location" value={(c0.address as string) ?? null} />
          <Stat label="Branch" value={client.branch} />
          <Stat label="Emergency" value={client.emergency} />
          <Stat label="Health Coach" value={coachName} />
          <Stat label="Owner (Front Desk)" value={ownerName} />
          {(c0.abha_id || c0.uhid) ? <Stat label="ABHA / UHID" value={`${c0.abha_id ?? "—"} / ${c0.uhid ?? "—"}`} /> : <div />}
        </div>
      </div>

      </div>)}

      {tab === "timeline" && (<>
      {/* One chronological record of the whole journey — purchases, consults,
          sessions, invoices, blood, workouts and onboarding milestones, newest
          first. What's still *pending* lives on Overview (Open now / Upcoming);
          this tab is the history. */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Journey timeline</div>
        <ActivityTimeline events={activity} today={todayISO()} max={60}
          emptyLabel="No activity recorded yet." />
      </div>

      {/* Sessions */}
      <div
        style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)", padding: "18px 20px",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Strength Sessions</div>
        {pkg?.is_facility && sess.length === 0 ? (
          // Only show the facility-only message when there really are no sessions.
          // A client who also holds Comprehensive/PT DOES have a session block —
          // don't let a facility membership hide it (and its Reschedule actions).
          (<div style={{ color: "var(--muted)", fontSize: 13 }}>This client has facility access only — no scheduled sessions, just check-in/out and a workout plan.
                      </div>)
        ) : sess.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No sessions scheduled.</div>
        ) : (
          <>
            <StrengthBlockActions clientId={client.id} trainers={trainers} defaultTrainerId={sess[0]?.trainer_id ?? ""} canReschedule={canManageSessions(me?.role ?? "") && sess.length === 12 && sess.every((session) => session.status === "scheduled")} />
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
              {sess.length} sessions · alternate days · {done} completed · {sess.length - done} upcoming
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11 }}>
                    <th style={{ padding: "8px 12px" }}>#</th>
                    <th style={{ padding: "8px 12px" }}>Date</th>
                    <th style={{ padding: "8px 12px" }}>Time</th>
                    <th style={{ padding: "8px 12px" }}>Trainer</th>
                    <th style={{ padding: "8px 12px" }}>Status</th>
                    <th style={{ padding: "8px 12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {sess.slice(0, 40).map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 12px" }}>{s.seq}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {s.date}
                        {s.rescheduled && (
                          <span style={{ marginLeft: 6, background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>
                            rescheduled
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px" }}>{fmtHour(s.hour)}</td>
                      <td style={{ padding: "8px 12px" }}>{s.staff?.name ?? "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span
                          style={{
                            borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                            background: s.status === "completed" ? "var(--green-bg)" : "var(--neutral-bg)",
                            color: s.status === "completed" ? "var(--green-text)" : "var(--muted)",
                          }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <SessionActions
                          id={s.id}
                          clientId={client.id}
                          date={s.date}
                          hour={s.hour}
                          trainerId={s.trainer_id}
                          status={s.status}
                          trainers={trainers}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      </>)}

      {tab === "card" && (<>
      {/* One column, one gap. Spacing lives here rather than on each card, so
          the layout cannot drift as cards are added, reordered, or hidden by a
          role check. */}
      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
      {/* Health profile — what the client wants and how their body is tracking.
          Goals and reported conditions are the client's own account, kept apart
          from the structured problem list above so the two are never confused. */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Health profile</div>
          {latestMeasure?.date && (
            <span style={{ color: "var(--muted)", fontSize: 12 }}>measured {fmtDate(latestMeasure.date)}</span>
          )}
        </div>

        {/* The numbers a clinician or coach wants before they say anything —
            read across in one line rather than hunted out of the table below.
            Each tile shows the latest recorded value; a dash means never
            measured, which is itself worth seeing at a glance. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: 10, marginBottom: 14 }}>
          {healthMetrics.map((m) => (
            <div key={m.label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px" }}>{m.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: m.tone ?? "var(--ink)" }}>{m.value}</div>
              {m.note && <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{m.note}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginBottom: 12 }}>
          <Stat label="Primary goal" value={(client.goals ?? []).join(", ") || "—"} />
          <Stat label="Reported conditions" value={client.conditions} />
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>Measurements &amp; InBody</div>
        {/* The written InBody interpretation belongs to the consultation, not
            to this card — the table below is the measurement record. */}
        {baselineRow && measures[0] && (baselineRow as Measure).date !== measures[0].date && (
          <InBodyComparison baseline={baselineRow as Measure} latest={measures[0] as Measure} />
        )}
        {measures.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>No measurements recorded yet.</div>
        ) : (
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11 }}>
                  <th style={{ padding: "6px 10px" }}>Date</th>
                  <th style={{ padding: "6px 10px" }}>Weight</th>
                  <th style={{ padding: "6px 10px" }}>BMI</th>
                  <th style={{ padding: "6px 10px" }}>Body fat %</th>
                  <th style={{ padding: "6px 10px" }}>Muscle</th>
                  <th style={{ padding: "6px 10px" }}>Visceral</th>
                  <th style={{ padding: "6px 10px" }}>Waist/Hip</th>
                  <th style={{ padding: "6px 10px" }}>RHR</th>
                </tr>
              </thead>
              <tbody>
                {measures.map((m) => (
                  <tr key={m.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 10px" }}>{m.date}</td>
                    <td style={{ padding: "6px 10px" }}>{m.weight ?? "—"}{m.weight ? " kg" : ""}</td>
                    <td style={{ padding: "6px 10px" }}>{m.bmi ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{m.body_fat ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{m.muscle_mass ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{m.visceral_fat ?? "—"}</td>
                    <td style={{ padding: "6px 10px" }}>{(m.waist ?? "—")}/{(m.hip ?? "—")}</td>
                    <td style={{ padding: "6px 10px" }}>{m.resting_hr ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canMeasure && <MeasurementForm clientId={params.id} />}
      </div>

      {/* Medical record — the clinical facts, read-only. They are edited on the
          chart at /emr/[id], which is the single link out. Split from the health
          profile below because the two answer different questions: this one is
          "what must a clinician know", that one is "how is this client doing". */}
      {canEmrRead && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Medical record</div>
            <span style={{ flex: 1 }} />
            <Link href={`/emr/${params.id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
              Open full record →
            </Link>
          </div>

          {/* Allergies lead, and stay loud. A severe allergy is the one thing
              on this page that must not be scrolled past. */}
          {emrAllergies.length > 0 && (
            <div style={{ background: "var(--red-bg)", border: "1px solid var(--red-bg)", borderRadius: 8, padding: "8px 11px", marginBottom: 10, fontSize: 12.5, color: "var(--red-text)" }}>
              <b>Allergies:</b> {emrAllergies.map((al) => `${al.substance}${al.severity === "severe" ? " (severe)" : ""}`).join(", ")}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px" }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>Active problems</div>
              <div style={{ fontSize: 12.5 }}>
                {emrProblems.length ? emrProblems.map((pr) => pr.description).join(" · ") : <span style={{ color: "var(--muted)" }}>None recorded</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>Current medication</div>
              <div style={{ fontSize: 12.5 }}>
                {emrMeds.length ? emrMeds.map((md) => `${md.name}${md.dose ? ` ${md.dose}` : ""}`).join(" · ") : <span style={{ color: "var(--muted)" }}>None recorded</span>}
              </div>
            </div>
          </div>

          {/* Prescriptions and lab orders are NOT listed here. They belong to
              the session that produced them, and Cureocity records shows each
              one under its consultation — listing them twice made it look like
              a client had two of everything. Current medication above is a
              different thing: it is what the client is taking now, whoever
              prescribed it and whenever. */}
        </div>
      )}

      {/* Cureocity records — consultations by discipline */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Cureocity records</div>
          <span style={{ flex: 1 }} />
        </div>
        {consults.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No consultation records yet.</div>
        ) : consultsByService.map((svc) => (
          <div key={svc.kind} style={{ marginBottom: 14 }}>
            {/* One heading per service, with the clinician the care team has
                assigned to it — the person answerable for this column of the
                client's care, whoever happened to open a given session. */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ ...(CONSULT_CHIP[svc.kind] ?? CONSULT_CHIP.Psychologist), borderRadius: 999, padding: "1px 9px", fontSize: 10.5, fontWeight: 700 }}>
                {CONSULT_LABEL[svc.kind] ?? svc.kind}
              </span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{svc.label}</span>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>· {svc.rows.length}</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                {svc.clinician ? `Health Professional: ${svc.clinician}` : "No Health Professional assigned"}
              </span>
            </div>
            {svc.rows.map((cs) => {
              const flags = (cs.flags ?? []) as { text: string; severity: string }[];
              const crit = flags.filter((f) => f.severity === "critical").length;
              const warn = flags.filter((f) => f.severity === "warning").length;
              const rx = rxByConsult.get(cs.id);
              const ord = ordersByConsult.get(cs.id);
              const hasSummary = !!(cs.summary || cs.ai_summary);
              return (
                <div key={cs.id} style={{ borderTop: "1px solid var(--border)", padding: "9px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
                    <span style={{ fontWeight: 700 }}>{sessionName(cs.kind, cs.id)}</span>
                    <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {cs.created_at ? `${fmtDate(cs.created_at)} · ${fmtTime(cs.created_at)}` : "—"}
                    </span>
                    {/* by_name is whoever opened the consultation, which is not
                        always the clinician who saw the client — an admin
                        starting a session on someone's behalf was being shown
                        as "with <admin>". Say what the field actually means. */}
                    {cs.by_name && <span style={{ color: "var(--muted)", fontSize: 12 }}>recorded by {cs.by_name}</span>}
                    {cs.duration_min ? <span style={{ color: "var(--muted)", fontSize: 12 }}>· {cs.duration_min} min</span> : null}
                    <span style={{ flex: 1 }} />
                    <span style={{ color: cs.status === "completed" ? "var(--green-text)" : "var(--amber-text)", fontSize: 11.5, fontWeight: 600 }}>{cs.status}</span>
                    {cs.approved && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>✔ approved</span>}
                    {cs.shared && <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>shared</span>}
                  </div>

                  {/* Flags raised in the session. A critical one is stated in
                      full — a count would bury the only line that matters. */}
                  {crit > 0 && (
                    <div style={{ marginTop: 5, background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "5px 9px", fontSize: 12 }}>
                      <b>Critical:</b> {flags.filter((f) => f.severity === "critical").map((f) => f.text).join(" · ")}
                    </div>
                  )}
                  {warn > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--amber-text)" }}>
                      {warn} warning{warn === 1 ? "" : "s"} raised
                    </div>
                  )}

                  {/* Everything this session produced, named. "Summary PDF"
                      told you the file format, not what the document is. */}
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {hasSummary ? (
                      <a href={`/consult/${cs.id}/print`} target="_blank" rel="noopener" className="attach">
                        <span className="attach-icon">PDF</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>{sessionName(cs.kind, cs.id)} summary</span>
                          <span style={{ display: "block", color: "var(--muted)", fontSize: 11.5 }}>{cs.created_at ? fmtDate(cs.created_at) : ""}</span>
                        </span>
                        <span style={{ flex: 1 }} />
                        <span className="attach-open">Open →</span>
                      </a>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>No summary written for this session yet.</div>
                    )}

                    {rx && (
                      <a href={`/rx/${rx.id}/print`} target="_blank" rel="noopener" className="attach">
                        <span className="attach-icon">PDF</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>Prescription</span>
                          <span style={{ display: "block", color: "var(--muted)", fontSize: 11.5 }}><span style={{ color: rx.shared_at ? "var(--green-text)" : "var(--amber-text)" }}>{rx.shared_at ? "In client portal" : "Not shared with client"}</span></span>
                        </span>
                        <span style={{ flex: 1 }} />
                        <span className="attach-open">Open →</span>
                      </a>
                    )}

                    {ord && (
                      <a href={`/lab/${cs.id}/print`} target="_blank" rel="noopener" className="attach">
                        <span className="attach-icon">PDF</span>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>Lab request — {ord.total} test{ord.total === 1 ? "" : "s"}</span>
                          <span style={{ display: "block", color: "var(--muted)", fontSize: 11.5 }}>{ord.resulted}/{ord.total} result{ord.total === 1 ? "" : "s"} received</span>
                        </span>
                        <span style={{ flex: 1 }} />
                        <span className="attach-open">Open →</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Prescriptions written outside a consultation — from the EMR chart, or
            before sessions recorded which one they came from. Without this band
            they would be listed nowhere on this page. */}
        {looseRx.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Not linked to a session</div>
            {looseRx.map((rx) => (
              <a key={rx.id} href={`/rx/${rx.id}/print`} target="_blank" rel="noopener" className="attach" style={{ marginBottom: 6 }}>
                <span className="attach-icon">PDF</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>Prescription</span>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: 11.5 }}>
                    {rx.signed_date ? fmtDate(rx.signed_date) : "unsigned"}{rx.provider ? ` · ${rx.provider}` : ""}
                  </span>
                </span>
                <span style={{ flex: 1 }} />
                <span className="attach-open">Open →</span>
              </a>
            ))}
          </div>
        )}

        {(dietPlans.length > 0 || dietAssessments.length > 0) && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 14, paddingTop: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>Nutrition documents</div>
            <div style={{ display: "grid", gap: 6 }}>
              {dietPlans.map((plan) => (
                <a key={plan.id} href={`/diet-plan/${plan.id}/print`} target="_blank" rel="noopener" className="attach">
                  <span className="attach-icon">PDF</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>Diet plan · v{plan.version}</span>
                    <span style={{ display: "block", color: "var(--muted)", fontSize: 11.5 }}>{plan.issued_on ? fmtDate(plan.issued_on) : plan.published_at ? fmtDate(plan.published_at) : "Issued"} · <span style={{ color: plan.shared_at ? "var(--green-text)" : "var(--amber-text)" }}>{plan.shared_at ? "In client portal" : "Not shared with client"}</span></span>
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="attach-open">Open →</span>
                </a>
              ))}
              {dietAssessments.map((assessment) => (
                <a key={assessment.id} href={`/diet-assessment/${assessment.id}/print`} target="_blank" rel="noopener" className="attach">
                  <span className="attach-icon">PDF</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: 12.5 }}>Dietary assessment summary · v{assessment.version}</span>
                    <span style={{ display: "block", color: "var(--muted)", fontSize: 11.5 }}>{assessment.issued_on ? fmtDate(assessment.issued_on) : assessment.published_at ? fmtDate(assessment.published_at) : "Issued"} · <span style={{ color: assessment.shared_at ? "var(--green-text)" : "var(--amber-text)" }}>{assessment.shared_at ? "In client portal" : "Not shared with client"}</span></span>
                  </span>
                  <span style={{ flex: 1 }} />
                  <span className="attach-open">Open →</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reports timeline. Summaries are written and read in the console; here
          a report is a filed document you open. Ordered by the date on the
          report, because a panel taken in July and filed in August belongs in
          July when you are reading a trend. */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 700 }}>Reports &amp; documents</div>
          {reportFiles.length > 0 && <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{reportFiles.length}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          Blood panels, other medical reports and InBody sheets — newest first.
        </div>

        {reportFiles.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No reports uploaded yet.</div>
        ) : reportMonths.map((m) => (
          <div key={m.key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>{m.label}</div>
            <div style={{ display: "grid", gap: 2 }}>
              {m.rows.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13, padding: "7px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ ...(REPORT_CHIP[r.kind] ?? REPORT_CHIP.medical_report), borderRadius: 999, padding: "1px 9px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {REPORT_LABEL[r.kind] ?? "Report"}
                  </span>
                  <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{r.report_label || r.name || "Report"}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(r.on)}</span>
                  {r.summary && <span style={{ color: "var(--muted)", fontSize: 11.5 }}>· summarised</span>}
                  <span style={{ flex: 1 }} />
                  {r.url && <a href={r.url} target="_blank" rel="noopener" style={{ color: "var(--brand-text)", fontWeight: 600, textDecoration: "none", fontSize: 12, whiteSpace: "nowrap" }}>Open PDF →</a>}
                </div>
              ))}
            </div>
          </div>
        ))}

        {!ro && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Add a medical report</div>
              <FileUploadForm variant="staff" clientId={params.id} kind="medical_report" label="Upload report" accept="application/pdf,image/*" />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Add a blood report</div>
              <FileUploadForm variant="staff" clientId={params.id} kind="blood_report" label="Upload blood report" accept=".pdf,image/*" />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Add an InBody report</div>
              <FileUploadForm variant="staff" clientId={params.id} kind="inbody" label="Upload InBody" accept="application/pdf,image/*" />
            </div>
          </div>
        )}
        {!ro && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
            Filing an InBody here stores the sheet only. The figures reach the
            measurement table either from <b>Extract from PDF</b> in the consultation
            console, or by entering them below.
          </div>
        )}


        {/* Panel status sits with the reports themselves — it used to live on
            the Overview tab while the report it describes was filed here, and
            that split is what let the two disagree. Given a prominent band
            because "awaiting" is a job somebody has to chase, not a footnote. */}
        {needsBlood && (() => {
          const awaiting = bloodPanels.filter((pn) => !bloodByPanel.get(pn)?.submitted).length;
          const done = bloodPanels.length - awaiting;
          // Amber while anything is outstanding, green once every panel is in.
          const tone = awaiting > 0
            ? { bg: "var(--amber-bg)", fg: "var(--amber-text)", edge: "var(--amber-text)" }
            : { bg: "var(--green-bg)", fg: "var(--green-text)", edge: "var(--green-text)" };
          return (
            <div style={{
              marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14,
            }}>
              <div style={{
                background: tone.bg, borderRadius: 10, padding: "12px 14px",
                borderLeft: `4px solid ${tone.edge}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".4px", textTransform: "uppercase", color: tone.fg }}>
                    Blood panel
                  </span>
                  <span style={{ background: "#fff", color: tone.fg, borderRadius: 999, padding: "1px 10px", fontSize: 11, fontWeight: 700 }}>
                    {awaiting > 0
                      ? `${awaiting} awaiting${done ? ` · ${done} received` : ""}`
                      : `All ${bloodPanels.length} received`}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: bloodPanels.length > 1 ? "1fr 1fr" : "1fr", gap: 16 }}>
                  {bloodPanels.map((panel) => {
                    const row = bloodByPanel.get(panel) ?? null;
                    const label = bloodPanels.length > 1 ? (BLOOD_PANEL_LABEL[panel] ?? panel) : undefined;
                    return (
                      <div key={panel}>
                        {ro
                          ? <div style={{ fontSize: 13, color: "var(--ink)" }}>{label ? <span style={{ fontWeight: 600 }}>{label}: </span> : null}{row ? (row.submitted ? `Received ${row.submitted_date ?? ""}` : `Requested ${row.requested_at ?? ""} · awaiting`) : "Not requested"}</div>
                          : <BloodActions clientId={params.id} blood={row} panel={panel} label={label} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Other paperwork — consents, ID scans, letters. Filed against the
            same client, so it belongs in the same card as the reports rather
            than in a second documents card six sections away. */}
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Other documents</div>
        {/* Clinical reports have their own dated timeline above. What is left
            is the paperwork around the client: consent forms, ID scans,
            insurance letters, anything filed without a clinical kind. */}
        <FilesGrid files={files.filter((f) => !REPORT_KINDS_SET.has(f.kind))} />
        {!ro && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 10 }}>
            {/* "document" is the catch-all kind, and the one this card lists.
                Clinical reports are uploaded from Reports above so they land in
                the timeline with a date and a type. */}
            <FileUploadForm variant="staff" clientId={params.id} kind="document" label="Upload document" accept=".pdf,image/*,.doc,.docx" />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              Consent forms, ID scans, letters. Blood, medical and InBody reports go in <b>Reports</b> above.
            </div>
          </div>
        )}
        </div>
      </div>


      {/* BluePrint status — BluePrint holders only (never Comprehensive) */}
      {showBlueprint && (
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>BluePrint</div>
          <span style={{ background: bp?.generated ? "var(--green-bg)" : "var(--amber-bg)", color: bp?.generated ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{bp?.generated ? "Generated" : "Pending"}</span>
          <span style={{ flex: 1 }} />
          {Boolean(bp) && <Link href={`/blueprint/${params.id}`} style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600, borderRadius: 8, padding: "4px 11px" }}>View report →</Link>}
          {canConsult(me?.role ?? "") && <Link href="/blueprint" style={{ color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>BluePrint workspace →</Link>}
        </div>
        {!bp?.generated && bpRequired.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>Required sign-offs · {bpRequired.filter((d) => bpSigned.has(d)).length}/{bpRequired.length}</span>
            {bpRequired.map((d) => {
              const on = bpSigned.has(d);
              return (
                <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: on ? "var(--green-bg)" : "var(--amber-bg)", color: on ? "var(--green-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
                  {on ? "✓" : "○"} {disciplineLabel(d)}
                </span>
              );
            })}
          </div>
        )}
        {bp?.scores && Object.keys(bp.scores).length > 0 && (() => {
          const vals = BP_SCORES.map((s) => bp!.scores![s.key]).filter((v): v is number => typeof v === "number");
          const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          return (
            <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <Gauge value={avg} size={168} unit="/ 100" label="Overall wellness" caption={`${vals.length} of ${BP_SCORES.length} scores`} />
              <div style={{ flex: 1, minWidth: 260, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 14, justifyItems: "center" }}>
                {BP_SCORES.filter((s) => typeof bp!.scores![s.key] === "number").map((s) => (
                  <RingMeter key={s.key} value={Number(bp!.scores![s.key])} size={80} stroke={9} label={s.label} />
                ))}
              </div>
            </div>
          );
        })()}
      </div>
      )}

      {/* Programme protocol — a client runs one journey, so this is one card.
          Both boards rendered adjacently before, near-identical, which read as
          two protocols rather than one client's programme. */}
      {(compView || ptView) && (
        <>
          {compView && (
            <ComprehensiveProtocol clientId={params.id} view={compView} canHold={canManageCoaching} canBook={!ro && canWrite(me?.role ?? "")} overseer={!ro && isBillingOverseer(me?.role ?? "")} services={bookServices} />
          )}
          {ptView && (
            <PTProtocol clientId={params.id} view={ptView} canHold={canManageCoaching} canBook={!ro && canWrite(me?.role ?? "")} overseer={!ro && isBillingOverseer(me?.role ?? "")} services={bookServices} />
          )}
        </>
      )}

      {/* Adherence & coaching — what the client has been given and how they are
          keeping to it. Three separate cards asked one question between them,
          each gated on the same role check; a coach reads them together or not
          at all. */}
      {(canManageCoaching || workouts.length > 0 || reads.length > 0) && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Adherence &amp; coaching</div>
          <div style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Assigned workouts</div>
            <span style={{ flex: 1 }} />
            {canEditFitness && <Link href="/exlib" style={{ color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Exercise Library →</Link>}
            {!canEditFitness && canManageCoaching && workouts.length > 0 && <a href="#care-coordination" style={{ color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Request trainer review ↑</a>}
          </div>
          {workouts.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{canEditFitness ? "No workouts assigned. Assign a template from the Exercise Library." : "No workout plan has been published yet."}</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {workouts.map((w) => (
                <div key={w.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <b style={{ fontSize: 14 }}>{w.name}</b>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{w.type} · {w.mode} · {w.items.length} exercises</span>
                    <span style={{ flex: 1 }} />
                    {canEditFitness && <form action={removeWorkout}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="client_id" value={params.id} /><button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>✕</button></form>}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      {w.items.map((it, i) => (
                        <tr key={i} style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                          <td style={{ padding: "5px 0", fontWeight: 600 }}>{it.exercise}</td>
                          <td style={{ padding: "5px 0", color: "var(--muted)" }}>{it.sets ?? ""} × {it.reps ?? ""}{it.rest ? ` · rest ${it.rest}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>⌚ Wearables</div>
            {latestRead && <span style={{ color: "var(--muted)", fontSize: 12 }}>· latest {latestRead.date}</span>}
            <span style={{ flex: 1 }} />
            {canManageCoaching && <WearableForm clientId={params.id} supervisorOverride={coachSupervisorOverride} />}
          </div>

          {latestRead ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, fontSize: 14, marginTop: 12 }}>
                <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Steps</div><b>{latestRead.steps?.toLocaleString() ?? "—"}</b></div>
                <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Sleep</div><b>{latestRead.sleep_min != null ? `${Math.floor(latestRead.sleep_min / 60)}h ${latestRead.sleep_min % 60}m` : "—"}</b></div>
                <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Resting HR</div><b>{latestRead.resting_hr ?? "—"}{latestRead.resting_hr != null ? " bpm" : ""}</b></div>
                <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Active</div><b>{latestRead.active_min != null ? `${latestRead.active_min} min` : "—"}</b></div>
                <div><div style={{ color: "var(--muted)", fontSize: 11 }}>Calories</div><b>{latestRead.calories?.toLocaleString() ?? "—"}</b></div>
              </div>
              {stepTrend.some((r) => r.steps != null) && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 6 }}>Steps · last 7 readings</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
                    {(() => { const max = Math.max(1, ...stepTrend.map((r) => r.steps ?? 0)); return stepTrend.map((r, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <div title={`${r.steps ?? 0} steps`} style={{ width: "100%", background: "var(--brand-fill)", borderRadius: "4px 4px 0 0", height: `${Math.round(((r.steps ?? 0) / max) * 48)}px`, minHeight: 2 }} />
                        <div style={{ fontSize: 9, color: "var(--muted)" }}>{r.date.slice(5)}</div>
                      </div>
                    )); })()}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>No wearable data yet.</div>
          )}

          {canManageCoaching && (
            <>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 14, marginBottom: 2 }}>Linked devices (integration-ready)</div>
              <WearableConnect clientId={params.id} connected={connMap} supervisorOverride={coachSupervisorOverride} />
            </>
          )}
          </div>
        </div>
      )}

      {/* Portal access (staff) */}
      {showPortal && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Client Portal access</div>
          <PortalLoginForm clientId={params.id} existingEmail={portalProfile?.email ?? null} />
        </div>
      )}

      </div>
      </>)}
    </div>
  );
}
