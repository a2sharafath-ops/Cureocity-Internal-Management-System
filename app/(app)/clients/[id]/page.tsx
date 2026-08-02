import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SessionActions from "@/components/SessionActions";
import PortalLoginForm from "@/components/PortalLoginForm";
import FileUploadForm from "@/components/FileUploadForm";
import FilesGrid from "@/components/FilesGrid";
import MeasurementForm from "@/components/MeasurementForm";
import InBodyComparison, { type Measure } from "@/components/InBodyComparison";
import HabitForm from "@/components/HabitForm";
import { WearableForm, WearableConnect } from "@/components/WearableForm";
import { archiveHabit, removeWorkout } from "@/lib/actions";
import { currentStreak, last7Count } from "@/lib/habits";
import { todayISO } from "@/lib/today";
import { packageCategory } from "@/lib/packages";
import { ageFromDob } from "@/lib/dob";
import InvoiceActions from "@/components/InvoiceActions";
import InvoiceForm from "@/components/InvoiceForm";
import AddPackage from "@/components/AddPackage";
import VoidPackageButton from "@/components/VoidPackageButton";
import { getProfile } from "@/lib/auth";
import { canWrite, canConsult, canBill, canManageInvoices, canVoidPackage, isBillingOverseer } from "@/lib/roles";

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

export default async function ClientDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; ro?: string } }) {
  const tab = ["overview", "timeline", "card"].includes(searchParams.tab ?? "") ? searchParams.tab! : "overview";
  // Read-only view (reached from another discipline's workspace): hide all edits.
  const ro = searchParams.ro === "1";
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*, packages(name, sessions, is_facility, price)")
    .eq("id", params.id)
    .maybeSingle();

  if (!client) notFound();
  const c0 = client as Record<string, unknown>;
  const ageOf = (dob: unknown): number | null =>
    typeof dob === "string" ? ageFromDob(dob) : null;

  const [{ data: sessions }, { data: trainerData }, { data: consultData }, { data: protoData }] = await Promise.all([
    supabase.from("sessions").select("*, staff(name)").eq("client_id", params.id).order("seq", { ascending: true }),
    supabase.from("staff").select("id, name").eq("is_trainer", true).order("name"),
    supabase.from("consultations").select("id, kind, status, summary, ai_summary, approved, shared, created_at").eq("client_id", params.id).order("created_at", { ascending: false }),
    supabase.from("care_protocols").select("id").eq("client_id", params.id).limit(1),
  ]);
  // Has this client's care journey already been kicked off? If so, the primary
  // "Start" action is done — we only offer a quiet re-run for repairs.
  // care_protocols covers PT/Comprehensive; BluePrint doesn't create one, so its
  // evidence (a blueprints row + blood request) is folded in below via `bp` /
  // `bloodRow` so the button doesn't keep offering "Start journey".
  const hasProtocol = ((protoData ?? []) as unknown[]).length > 0;
  const trainers = (trainerData ?? []) as { id: string; name: string }[];
  const consults = (consultData ?? []) as { id: string; kind: string; status: string; summary: string | null; ai_summary: string | null; approved: boolean; shared: boolean; created_at: string | null }[];

  const me = await getProfile();
  const showPortal = !ro && canWrite(me?.role ?? "");
  const { data: portalProfile } = showPortal
    ? await supabase.from("profiles").select("email").eq("client_id", params.id).eq("role", "Client").maybeSingle()
    : { data: null };

  // files + signed URLs
  const { data: fileRows } = await supabase
    .from("files").select("id, name, kind, path, created_at").eq("client_id", params.id).order("created_at", { ascending: false });
  const files = await Promise.all(((fileRows ?? []) as { id: string; name: string | null; kind: string; path: string; created_at: string }[]).map(async (f) => {
    const { data: signed } = await supabase.storage.from("client-files").createSignedUrl(f.path, 3600);
    return { id: f.id, name: f.name, kind: f.kind, created_at: f.created_at, url: signed?.signedUrl ?? null };
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

  const canCoach = !ro && canConsult(me?.role ?? "");
  const [{ data: habitRows }, { data: habitLogRows }] = await Promise.all([
    supabase.from("habits").select("id, name, icon, cadence, target_per_week, active").eq("client_id", params.id).eq("active", true).order("created_at"),
    supabase.from("habit_logs").select("habit_id, date").eq("client_id", params.id).eq("done", true),
  ]);
  const habits = (habitRows ?? []) as { id: string; name: string; icon: string | null; cadence: string; target_per_week: number; active: boolean }[];
  const habitDates = new Map<string, Set<string>>();
  for (const l of ((habitLogRows ?? []) as { habit_id: string; date: string }[])) {
    (habitDates.get(l.habit_id) ?? habitDates.set(l.habit_id, new Set()).get(l.habit_id)!).add(l.date);
  }
  const habToday = todayISO();

  const [{ data: wearConns }, { data: wearReads }] = await Promise.all([
    supabase.from("wearable_connections").select("provider, status").eq("client_id", params.id),
    supabase.from("wearable_readings").select("date, steps, resting_hr, sleep_min, active_min, calories, source").eq("client_id", params.id).order("date", { ascending: false }).limit(30),
  ]);
  const connMap: Record<string, string> = {};
  for (const c of ((wearConns ?? []) as { provider: string; status: string }[])) connMap[c.provider] = c.status;
  const reads = (wearReads ?? []) as { date: string; steps: number | null; resting_hr: number | null; sleep_min: number | null; active_min: number | null; calories: number | null; source: string }[];
  const latestRead = reads[0] ?? null;
  const stepTrend = reads.slice(0, 7).reverse(); // oldest→newest of last 7

  const { data: cwData } = await supabase.from("client_workouts").select("id, name, mode, type, items, assigned_by, created_at").eq("client_id", params.id).order("created_at", { ascending: false });
  // Prescriptions rendered only on the EMR chart before this — invisible on the
  // client's own card, which is where front desk and coaches actually look.
  const { data: rxData } = await supabase.from("prescriptions")
    .select("id, status, provider, signed_date, shared_at, prescription_items(drug, dose, frequency, duration)")
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
    id: string; status: string; provider: string | null; signed_date: string | null; shared_at: string | null;
    prescription_items: { drug: string; dose: string | null; frequency: string | null; duration: string | null }[];
  }[];
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
  // The full care team assigned to this client, per discipline, in a stable order.
  const CT_LABEL: Record<string, string> = { doctor: "Doctor", dietitian: "Dietitian", trainer: "Fitness Trainer", coach: "Health Coach", psychologist: "Psychologist" };
  const careTeam = ["doctor", "dietitian", "trainer", "coach", "psychologist"]
    .map((d) => ({ disc: CT_LABEL[d], name: assignByDisc.get(d) ? (staffMap.get(String(assignByDisc.get(d))) ?? null) : null }))
    .filter((x) => x.name) as { disc: string; name: string }[];
  const bp = (bpRow ?? null) as { generated: boolean; generated_date: string | null; scores: Record<string, number> | null } | null;
  // BluePrint consolidated sign-off progress: who's assigned (required) and
  // who's signed. Shown as a "required sign-offs" line so front desk sees who's
  // still pending before the Blueprint can generate.
  const BP_DISC_LABEL: Record<string, string> = { doctor: "Doctor", dietitian: "Dietitian", trainer: "Trainer", coach: "Coach", psychologist: "Psychologist" };
  const bpRequired = ((assignRows ?? []) as { discipline: string }[]).map((r) => r.discipline).filter((d) => BP_DISC_LABEL[d]);
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

  const pkg = (client as { packages: { name: string; sessions: number; is_facility: boolean; price: number } | null }).packages;
  const sess = (sessions ?? []) as {
    id: string; seq: number; date: string; hour: number; status: string; rescheduled: boolean;
    trainer_id: string; staff: { name: string } | null;
  }[];
  const done = sess.filter((s) => s.status === "completed").length;

  // One activity stream. Assembled from rows the page already fetches, so it
  // costs nothing extra — the data was always here, it was just displayed as
  // six independently-sorted tables.
  const activity: TimelineEvent[] = buildTimeline([
    // Package purchases — where the journey begins.
    clientPackages.filter((c) => c.status !== "void").map((c) => ({
      at: atDay(c.start_date) ?? "", kind: "package" as const,
      title: `${c.package_name ?? c.category} purchased`, detail: c.category,
    })),
    sess.map((x) => ({
      at: atDay(x.date) ?? "", kind: "session" as const,
      title: `Strength session ${x.seq ?? ""}`.trim(),
      detail: x.status, pending: x.status === "scheduled",
    })),
    consults.map((c) => ({
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
          <RealtimeRefresh tables={["sessions","consultations","files","measurements","meal_logs","invoices","habits","habit_logs","wearable_readings","wearable_connections","client_workouts","prescriptions","blood_requests","client_packages","client_assignments"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>{client.name}</h1>
            <ClientStatusBadge status={detailStatus} />
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {client.code} · {pkg?.name ?? "—"} · joined {client.joined ?? "—"}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {ro
          ? <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700 }}>Read-only</span>
          : <Link
              href={`/clients/${params.id}/edit`}
              style={{ border: "1px solid var(--border)", background: "#fff", color: "var(--ink)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
            >
              Edit
            </Link>}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <SegTabs active={tab} items={[
          { key: "overview", label: "Overview", href: `/clients/${params.id}?tab=overview${ro ? "&ro=1" : ""}` },
          { key: "timeline", label: "Service Timeline", href: `/clients/${params.id}?tab=timeline${ro ? "&ro=1" : ""}` },
          { key: "card", label: "Client Card", href: `/clients/${params.id}?tab=card${ro ? "&ro=1" : ""}` },
        ]} />
      </div>

      {tab === "overview" && (<>
      {/* ---- What's pending (the single journey tracker + the actionable items) ---- */}
      {/* Package status — the one place the client's journey & to-dos live */}
      {pkgStatus && (pkgStatus.openNow.length > 0 || pkgStatus.upcoming.length > 0) && (
        <PackageStatusPanel openNow={pkgStatus.openNow} upcoming={pkgStatus.upcoming} clientId={params.id} canChase={!ro && isBillingOverseer(me?.role ?? "")} viewerStaffId={me?.staffId ?? null} />
      )}
      {/* Schedule the strength-session block right here on Overview — front desk
          doesn't have to hop to the Client Card tab. Shows only for PT /
          Comprehensive clients who don't yet have sessions booked. */}
      {!ro && canWrite(me?.role ?? "") && isPtOrComp && !hasScheduledSessions && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Strength sessions</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>Book this client&apos;s strength-session block — pick a trainer, start date and time.</div>
          <ScheduleSessionsForm clientId={params.id} trainers={trainers} defaultTrainerId={assignedTrainerId} />
        </div>
      )}

      {/* Blood report — a pending journey step, kept near the top with the to-dos */}
      {needsBlood && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>Blood report</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: bloodPanels.length > 1 ? "1fr 1fr" : "1fr", gap: 16 }}>
            {bloodPanels.map((panel) => {
              const row = bloodByPanel.get(panel) ?? null;
              const label = bloodPanels.length > 1 ? (BLOOD_PANEL_LABEL[panel] ?? panel) : undefined;
              return (
                <div key={panel}>
                  {ro
                    ? <div style={{ fontSize: 13, color: "var(--muted)" }}>{label ? <span style={{ fontWeight: 600 }}>{label}: </span> : null}{row ? (row.submitted ? `Received ${row.submitted_date ?? ""}` : `Requested ${row.requested_at ?? ""} · awaiting`) : "Not requested"}</div>
                    : <BloodActions clientId={params.id} blood={row} panel={panel} label={label} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Commercial ---- */}
      {/* Deals / Packages */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Deals / Packages</div>
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

        {showBilling && invoices.length > 0 && (
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

      {/* ---- Reference — care team, profile & identity ---- */}
      {/* Care Team */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Care Team</div>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>· assigned clinicians</span>
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
        ) : <div style={{ color: "var(--muted)", fontSize: 13 }}>No clinicians assigned yet.</div>}
      </div>

      {/* Health Profile */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Health Profile</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Stat label="Primary Goal" value={(client.goals ?? []).join(", ") || "—"} />
          <Stat label="Conditions" value={client.conditions} />
        </div>
      </div>

      {/* Personal Info */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Personal Info</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <Stat label="Phone" value={client.phone} />
          <Stat label="Email" value={client.email} />
          <Stat label="Age" value={clientAge != null ? `${clientAge} yrs` : "—"} />
          <Stat label="Gender" value={client.gender} />
          <Stat label="Occupation" value={client.occupation} />
          <Stat label="Height / Weight" value={`${client.height ?? "—"} cm · ${client.weight ?? "—"} kg`} />
          <Stat label="Location" value={(c0.address as string) ?? null} />
          <Stat label="Branch" value={client.branch} />
          <Stat label="Emergency" value={client.emergency} />
          <Stat label="Health Coach" value={coachName} />
          <Stat label="Owner (Front Desk)" value={ownerName} />
          {(c0.abha_id || c0.uhid) ? <Stat label="ABHA / UHID" value={`${c0.abha_id ?? "—"} / ${c0.uhid ?? "—"}`} /> : <div />}
        </div>
      </div>

      </>)}

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
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Facility access member — no scheduled sessions (check-in/out + workout plan).
          </div>
        ) : sess.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No sessions scheduled.</div>
        ) : (
          <>
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
      {/* Care records — consultations by discipline */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Care records</div>
          <span style={{ flex: 1 }} />
          {canConsult(me?.role ?? "") && <Link href="/emr" style={{ color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Client Records →</Link>}
        </div>
        {consults.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No consultation records yet.</div>
        ) : (
          ["Doctor", "Diet", "Trainer", "Coach", "Psychologist"].map((kind) => {
            const list = consults.filter((c) => c.kind === kind);
            if (list.length === 0) return null;
            return (
              <div key={kind} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", margin: "6px 0 4px" }}>{kind} consultations ({list.length})</div>
                {list.map((cs) => (
                  <div key={cs.id} style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ background: cs.status === "completed" ? "var(--green-bg)" : "var(--neutral-bg)", color: cs.status === "completed" ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{cs.status}</span>
                      {cs.approved && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>✔ approved</span>}
                      {cs.shared && <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "2px 9px", fontSize: 11 }}>shared</span>}
                    </div>
                    {cs.summary && <div style={{ marginTop: 5, fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap" }}>{cs.summary}</div>}
                    {cs.ai_summary && <div style={{ marginTop: 6, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, whiteSpace: "pre-wrap" }}><span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px" }}>Summary</span><div style={{ marginTop: 4, color: "var(--ink)" }}>{cs.ai_summary}</div></div>}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* BluePrint status — BluePrint holders only (never Comprehensive) */}
      {showBlueprint && (
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
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
                  {on ? "✓" : "○"} {BP_DISC_LABEL[d]}
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

      {/* Measurements / InBody */}
      <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Measurements / InBody</div>
        </div>
        {(() => { const s = (measures[0] as { ai_summary?: string | null } | undefined)?.ai_summary; return s ? (
          <div style={{ marginBottom: 12, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, whiteSpace: "pre-wrap" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px" }}>Summary · latest InBody</span>
            <div style={{ marginTop: 4, color: "var(--ink)" }}>{s}</div>
          </div>
        ) : null; })()}
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

      {/* Progress Photos */}
      {(() => {
        const photos = files.filter((f) => f.kind === "progress_photo" && f.url).sort((a, b) => a.created_at.localeCompare(b.created_at));
        if (photos.length === 0) return null;
        const first = photos[0], latest = photos[photos.length - 1];
        return (
          <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Progress Photos <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>· {photos.length}</span></div>
            {photos.length >= 2 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[["Baseline", first], ["Latest", latest]].map(([label, ph]) => {
                  const p2 = ph as typeof first;
                  return (
                    <div key={label as string}>
                      <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 4 }}>{label as string} · {p2.created_at.slice(0, 10)}</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p2.url ?? ""} alt={label as string} style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)", aspectRatio: "3/4", objectFit: "cover" }} />
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={ph.id} src={ph.url ?? ""} alt={ph.created_at} title={ph.created_at.slice(0, 10)} style={{ width: 68, height: 90, borderRadius: 8, border: "1px solid var(--border)", objectFit: "cover" }} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Habits & streaks */}
      {(canCoach || habits.length > 0) && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Habits &amp; streaks</div>
            <span style={{ flex: 1 }} />
            {canCoach && <HabitForm clientId={params.id} />}
          </div>
          {habits.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 10 }}>No habits assigned yet.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {habits.map((h) => {
                const dates = habitDates.get(h.id) ?? new Set<string>();
                const streak = currentStreak(dates, habToday);
                const week = last7Count(dates, habToday);
                const hit = week >= h.target_per_week;
                return (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                    <div style={{ fontSize: 18 }}>{h.icon ?? "✅"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{h.cadence} · target {h.target_per_week}/wk</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 88 }}>
                      <div style={{ fontWeight: 700, color: streak > 0 ? "var(--brand-text)" : "var(--muted)" }}>{streak}d streak</div>
                      <div style={{ fontSize: 12, color: hit ? "var(--green-text)" : "var(--muted)" }}>{week}/{h.target_per_week} this week{hit ? " ✓" : ""}</div>
                    </div>
                    {canCoach && (
                      <form action={archiveHabit}>
                        <input type="hidden" name="id" value={h.id} /><input type="hidden" name="client_id" value={params.id} />
                        <button type="submit" title="Archive" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>Archive</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Wearables */}
      {(canCoach || reads.length > 0) && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>⌚ Wearables</div>
            {latestRead && <span style={{ color: "var(--muted)", fontSize: 12 }}>· latest {latestRead.date}</span>}
            <span style={{ flex: 1 }} />
            {canCoach && <WearableForm clientId={params.id} />}
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

          {canCoach && (
            <>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 14, marginBottom: 2 }}>Linked devices (integration-ready)</div>
              <WearableConnect clientId={params.id} connected={connMap} />
            </>
          )}
        </div>
      )}

      {compView && (
        <ComprehensiveProtocol clientId={params.id} view={compView} canHold={canCoach} canBook={!ro && canWrite(me?.role ?? "")} overseer={!ro && isBillingOverseer(me?.role ?? "")} services={bookServices} />
      )}

      {ptView && (
        <PTProtocol clientId={params.id} view={ptView} canHold={canCoach} canBook={!ro && canWrite(me?.role ?? "")} overseer={!ro && isBillingOverseer(me?.role ?? "")} services={bookServices} />
      )}

      {/* Prescriptions. `shared_at` distinguishes a draft the doctor is still
          writing from one the client can actually see in their portal — the
          distinction the 24h delivery clock measures. */}
      {prescriptions.length > 0 && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Prescriptions</div>
            <span style={{ flex: 1 }} />
            <Link href={`/emr/${params.id}`} style={{ color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Open chart →</Link>
          </div>
          {prescriptions.map((rx) => (
            <div key={rx.id} style={{ borderTop: "1px solid var(--border)", padding: "9px 0", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                <b>{rx.provider ?? "Doctor"}</b>
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{rx.signed_date ?? "unsigned"}</span>
                <span style={{ flex: 1 }} />
                <span style={{
                  background: rx.shared_at ? "var(--green-bg)" : "var(--amber-bg)",
                  color: rx.shared_at ? "var(--green-text)" : "var(--amber-text)",
                  borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700,
                }}>
                  {rx.shared_at ? "In client portal" : "Not yet shared"}
                </span>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                {(rx.prescription_items ?? []).map((i) => i.drug + (i.dose ? ` ${i.dose}` : "")).join(" · ") || "No items"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assigned workouts */}
      {(canCoach || workouts.length > 0) && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Assigned workouts</div>
            <span style={{ flex: 1 }} />
            {canCoach && <Link href="/exlib" style={{ color: "var(--brand-text)", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Exercise Library →</Link>}
          </div>
          {workouts.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>No workouts assigned. Assign a template from the Exercise Library.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {workouts.map((w) => (
                <div key={w.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <b style={{ fontSize: 14 }}>{w.name}</b>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{w.type} · {w.mode} · {w.items.length} exercises</span>
                    <span style={{ flex: 1 }} />
                    {canCoach && <form action={removeWorkout}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="client_id" value={params.id} /><button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>✕</button></form>}
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
      )}

      {/* Files */}
      <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Files &amp; documents</div>
        <FilesGrid files={files} />
        {!ro && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Upload blood report (PDF/image)</div>
            <FileUploadForm variant="staff" clientId={params.id} kind="blood_report" label="Upload blood report" accept=".pdf,image/*" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Upload progress photo</div>
            <FileUploadForm variant="staff" clientId={params.id} kind="progress_photo" label="Upload photo" accept="image/*" />
          </div>
        </div>
        )}
      </div>

      {/* Portal access (staff) */}
      {showPortal && (
        <div style={{ marginTop: 16, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Client Portal access</div>
          <PortalLoginForm clientId={params.id} existingEmail={portalProfile?.email ?? null} />
        </div>
      )}
      </>)}
    </div>
  );
}
