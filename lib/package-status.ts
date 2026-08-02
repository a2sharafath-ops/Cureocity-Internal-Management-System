// "Package status — open & upcoming" for one client. Rolls every wired package
// obligation — payments, blood report, consults, clinician deliverables,
// strength sessions and calendar milestones — into two plain lists so front
// desk sees the whole picture in one place, without depending on the
// care_protocols row the Comprehensive board needs.

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { COMPREHENSIVE_CATEGORY, milestoneDates, cyclesFor, DIET_DRAFT_MS, WORKOUT_PLAN_MS } from "@/lib/comprehensive";
import { clock, formatLeft } from "@/lib/sla-clock";
import { loadClientStatuses } from "@/lib/client-status";
import { onboardingRow, type ClientInput } from "@/lib/onboarding";
import { buildOwnerResolver, outstandingDeliverables, unsatisfiedMilestones, type AssignRow, type ApptOwnerRow, type ApptMatchRow } from "@/lib/obligations";

export type StatusItem = { label: string; detail?: string; href?: string; tone: "warn" | "info" | "neutral"; ownerStaffId?: string; ownerName?: string; ownerCta?: string; chaseRoles?: string[]; chaseWho?: string; sortKey?: string; dueLabel?: string; overdue?: boolean };

// Ops work with no single clinician owner (bookings, blood chase, invoices) is
// owned by the front desk — overseers chase them rather than doing it themselves.
const FRONT_DESK: Pick<StatusItem, "chaseRoles" | "chaseWho"> = { chaseRoles: ["Front Desk"], chaseWho: "Front Desk" };
export type PackageStatus = { openNow: StatusItem[]; upcoming: StatusItem[] };

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
// A full date+time in clinic-local (IST), for the turnaround SLA deadlines.
const fmtDT = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).replace(",", "");

export async function getPackageStatus(clientId: string): Promise<PackageStatus | null> {
  const p = await getProfile();
  if (!p || !canSee(p.role, "/clients")) return null;
  const sb = createClient();
  const today = todayISO();

  const [{ data: cps }, { data: inv }, { data: blood }, { data: cons }, { data: appts }, { data: sess }, { data: charts }, { data: workouts }, { data: bp }, { data: proto }] = await Promise.all([
    sb.from("client_packages").select("package_id, package_name, category, status, start_date, end_date").eq("client_id", clientId),
    sb.from("invoices").select("num, description, amount, status").eq("client_id", clientId),
    sb.from("blood_requests").select("panel, submitted").eq("client_id", clientId),
    sb.from("consultations").select("kind, status, completed_at").eq("client_id", clientId),
    sb.from("appointments").select("client_id, type, date, status, provider_id, staff:provider_id(name, role)").eq("client_id", clientId).neq("status", "cancelled"),
    sb.from("sessions").select("status, date").eq("client_id", clientId).neq("status", "cancelled"),
    sb.from("diet_charts").select("id").eq("client_id", clientId).limit(1),
    sb.from("client_workouts").select("id").eq("client_id", clientId).limit(1),
    sb.from("blueprints").select("generated").eq("client_id", clientId).maybeSingle(),
    sb.from("care_protocols").select("start_date, approved_at").eq("client_id", clientId).eq("protocol", COMPREHENSIVE_CATEGORY).eq("status", "active").maybeSingle(),
  ]);

  // The Day-2 "diet chart explanation" lives in the follow-ups system, not the
  // milestone set — pull it so the client card shows the whole plan.
  const { data: fus } = await sb.from("followups").select("label, day, due_date, stage").eq("client_id", clientId);
  const dietExplain = ((fus ?? []) as { label: string; day: number | null; due_date: string; stage: string }[])
    .find((f) => f.day === 2 && /explanation/i.test(f.label));
  const FU_CLOSED = new Set(["BOOKED", "COMPLETED", "NO_CONSULT"]);

  // Who owns each clinician deliverable — the shared resolver (care-team
  // assignment, then the completed-consult provider as fallback), so ops roles
  // nudge the right person instead of being sent to a workspace they can't act in.
  const { data: asg } = await sb.from("client_assignments").select("client_id, discipline, staff_id, staff:staff_id(name)").eq("client_id", clientId);
  const ownerFor = buildOwnerResolver(
    (asg ?? []) as unknown as AssignRow[],
    (appts ?? []) as unknown as ApptOwnerRow[],
  );

  const active = ((cps ?? []) as { package_id: string | null; package_name: string | null; category: string; status: string; start_date: string | null; end_date: string | null }[]).filter((c) => c.status === "active");
  if (!active.length && !(bp && !bp.generated)) return { openNow: [], upcoming: [] };
  const cats = new Set(active.map((c) => c.category));
  const isComp = cats.has("comprehensive"), isPt = cats.has("training");
  const clientHref = `/clients/${clientId}`;
  const openNow: StatusItem[] = [];
  const upcoming: StatusItem[] = [];

  // ---- payments -----------------------------------------------------------
  // Only genuinely-outstanding invoices are an open item. Paid ones are done;
  // Void / Cancelled / Refunded ones are settled (e.g. an invoice for a removed
  // package) and must not sit in "open now" waiting to be actioned.
  const SETTLED_INVOICE = new Set(["Paid", "Void", "Cancelled", "Refunded"]);
  for (const i of (inv ?? []) as { num: number | null; description: string | null; amount: number; status: string }[]) {
    if (!SETTLED_INVOICE.has(i.status)) openNow.push({ label: `Invoice INV-${String(i.num ?? 0).padStart(3, "0")} ${i.status.toLowerCase()}`, detail: `${i.description ?? "Package"} · ₹${Number(i.amount).toLocaleString("en-IN")}`, href: "/billing", tone: "warn", chaseRoles: ["Front Desk", "Finance"], chaseWho: "Front Desk" });
  }

  // ---- onboarding checklist (canonical) ----------------------------------
  // Reuse the same engine the Onboarding page runs, so the client's pending
  // journey steps — blood, consults, blueprint generation, sessions scheduled —
  // appear here with their real action links, and the two never disagree.
  const st = (await loadClientStatuses(sb, [clientId], today)).get(clientId);
  const allSess = (sess ?? []) as { status: string; date: string }[];
  if (st && ["blueprint", "comprehensive", "training", "membership"].includes(st.category)) {
    const activeCp = active.find((c) => c.category === st.category);
    const input: ClientInput = {
      clientId, clientName: "", category: st.category,
      packageName: activeCp?.package_name ?? st.category,
      ownerName: null, hasInvoice: (inv ?? []).length > 0,
      bloodRequested: st.bloodRequested, bloodSubmitted: st.bloodSubmitted,
      doctor: { scheduled: st.consults.doctor?.booked ?? false, completed: st.consults.doctor?.completed ?? false },
      diet: { scheduled: st.consults.dietitian?.booked ?? false, completed: st.consults.dietitian?.completed ?? false },
      trainer: { scheduled: st.consults.trainer?.booked ?? false, completed: st.consults.trainer?.completed ?? false },
      blueprintGenerated: Boolean(bp?.generated),
      sessionScheduled: allSess.some((s) => s.status === "scheduled"),
    };
    for (const step of onboardingRow(input).steps) {
      if (step.done) continue;
      // The strength-session booking has its own dedicated "Schedule sessions"
      // card on the client Overview, so don't also list it here — one flow, not
      // two.
      if (/session/i.test(step.label)) continue;
      // A booked-but-not-yet-held consult isn't an open ops action — it's
      // scheduled and waiting on the clinician. Show it under Upcoming, not
      // Open now, so Open now only lists work that still needs doing.
      if (step.booked) upcoming.push({ label: step.label, href: step.action?.href ?? clientHref, tone: "info" });
      else openNow.push({ label: step.label, href: step.action?.href ?? clientHref, tone: "warn", ...FRONT_DESK });
    }
  }

  // ---- clinician deliverables the onboarding ladder doesn't track ----------
  const doneKinds = new Set(((cons ?? []) as { kind: string; status: string }[]).filter((c) => c.status === "completed").map((c) => c.kind));
  // Earliest completion per consult kind — the trigger the turnaround SLA counts
  // from (diet chart owed 24h after the diet consult; workout plan 24h after the
  // fitness assessment). Lets the client card show the real deadline, not just
  // "open". Note: this is a display hint and doesn't discount freeze/pause time —
  // the Comprehensive / PT board stays the authoritative breach record.
  const completedAtOf = new Map<string, string>();
  for (const c of (cons ?? []) as { kind: string; status: string; completed_at: string | null }[]) {
    if (c.status === "completed" && c.completed_at) {
      const prev = completedAtOf.get(c.kind);
      if (!prev || c.completed_at < prev) completedAtOf.set(c.kind, c.completed_at);
    }
  }
  const nowMs = Date.now();
  const slaHint = (startAt: string | null | undefined, windowMs: number): Pick<StatusItem, "dueLabel" | "overdue"> => {
    const c = clock(startAt, null, windowMs, nowMs);
    if (!c.dueAt) return {};
    return { dueLabel: `due by ${fmtDT(c.dueAt)} · ${formatLeft(c.msLeft)}`, overdue: c.status === "breached" };
  };
  // Comprehensive blood is a separate panel — the onboarding step only checks it
  // was *requested*; the client still owes the actual report.
  const compBlood = ((blood ?? []) as { panel: string | null; submitted: boolean }[]).find((b) => (b.panel ?? "blueprint") === "comprehensive");
  const hasChart = ((charts ?? []) as unknown[]).length > 0;
  const hasWorkout = ((workouts ?? []) as unknown[]).length > 0;
  // Clinician-owed deliverables: name the responsible clinician so ops roles can
  // nudge them, rather than linking to a workspace they can't act in.
  const diet = ownerFor(clientId, "dietitian"), trainer = ownerFor(clientId, "trainer"), coach = ownerFor(clientId, "coach");
  // Shared detection — which Comprehensive/PT deliverables are still outstanding.
  const deliv = new Set(outstandingDeliverables({
    isComp, isPt, dietConsultDone: doneKinds.has("Diet"), trainerConsultDone: doneKinds.has("Trainer"),
    hasChart, hasWorkout, compBloodSubmitted: compBlood ? compBlood.submitted : null,
  }));
  // Blood card + consolidated approval live on this same page, so no cross-link.
  if (deliv.has("compblood")) openNow.push({ label: "Comprehensive blood report — awaiting client", tone: "warn", chaseRoles: ["Health Coach"], chaseWho: "Health Coach" });
  if (deliv.has("dietchart")) openNow.push({ label: "Diet chart — not drafted", detail: diet ? `Owed by ${diet.name}` : undefined, ownerStaffId: diet?.id, ownerName: diet?.name, ownerCta: "Draft chart", href: "/workspace?role=diet&tab=charts", tone: "warn", ...slaHint(completedAtOf.get("Diet"), DIET_DRAFT_MS) });
  if (deliv.has("workout")) openNow.push({ label: "Workout plan — not created", detail: trainer ? `Owed by ${trainer.name}` : undefined, ownerStaffId: trainer?.id, ownerName: trainer?.name, ownerCta: "Create plan", href: "/workspace?role=trainer&tab=planner", tone: "warn", ...slaHint(completedAtOf.get("Trainer"), WORKOUT_PLAN_MS) });
  // Day-2 diet chart explanation — the Health Coach owns scheduling it, but only
  // once the dietitian's chart draft exists (you can't explain a chart that
  // hasn't been written). Until then the "Diet chart — not drafted" item above
  // is what's outstanding. Chased against the assigned coach, not front desk.
  if (isComp && dietExplain && !FU_CLOSED.has(dietExplain.stage) && hasChart) {
    const coachOwned: Pick<StatusItem, "ownerStaffId" | "ownerName" | "chaseRoles" | "chaseWho"> =
      coach ? { ownerStaffId: coach.id, ownerName: coach.name, chaseRoles: ["Health Coach"], chaseWho: "Health Coach" }
            : { chaseRoles: ["Health Coach"], chaseWho: "Health Coach" };
    if (dietExplain.due_date <= today) openNow.push({ label: "Diet chart explanation — due", detail: `Day 2 · was due ${fmt(dietExplain.due_date)}`, href: `/followups?client=${clientId}`, tone: "warn", ...coachOwned });
    else upcoming.push({ label: "Diet chart explanation (Day 2)", detail: `by ${fmt(dietExplain.due_date)}`, href: `/followups?client=${clientId}`, tone: "info", sortKey: dietExplain.due_date, ...coachOwned });
  }

  // ---- strength sessions remaining (scheduling itself is an onboarding step) --
  if (isComp || isPt) {
    const total = allSess.length;
    const remaining = total - allSess.filter((s) => s.status === "completed").length;
    if (total > 0 && remaining > 0) {
      const next = allSess.filter((s) => s.status !== "completed" && s.date >= today).map((s) => s.date).sort()[0];
      upcoming.push({ label: `${remaining} of ${total} strength sessions remaining`, detail: next ? `next ${fmt(next)}` : undefined, href: "/sessions", tone: "info", sortKey: next, ...FRONT_DESK });
    }
  }

  // ---- comprehensive calendar milestones ---------------------------------
  if (isComp) {
    const comp = active.find((c) => c.category === "comprehensive");
    const start = proto?.start_date ?? comp?.start_date ?? null;
    if (start) {
      // Resolve each booking's type to its service category so a manually-booked
      // service ("10th Day Diet Followup") counts against its milestone; and use
      // the catalogue (name/category/day) to build a pre-filled Book link.
      const { data: svcData } = await sb.from("services").select("name, category, day_offset");
      const services = (svcData ?? []) as { name: string; category: string; day_offset: number | null }[];
      const spanDays = comp?.end_date ? Math.max(28, daysBetween(start, comp.end_date)) : 28;
      for (const m of unsatisfiedMilestones(clientId, milestoneDates(start, cyclesFor(spanDays)), (appts ?? []) as ApptMatchRow[], services)) {
        if (today > m.dueDate) openNow.push({ label: `${m.label} — overdue`, detail: `was due ${fmt(m.dueDate)}`, href: m.bookHref, tone: "warn", ...FRONT_DESK });
        else upcoming.push({ label: m.label, detail: `by ${fmt(m.dueDate)}`, href: m.bookHref, tone: "info", sortKey: m.dueDate, ...FRONT_DESK });
      }
    }
  }

  // ---- package end dates --------------------------------------------------
  for (const c of active) {
    if (!c.end_date) continue;
    upcoming.push({ label: `${c.package_name ?? c.category} ends`, detail: fmt(c.end_date), tone: "neutral", sortKey: c.end_date });
  }

  // Sort by the real ISO due-date (chronological). Items without a date sort
  // last. Previously this sorted the formatted detail string, which mixed
  // "by 08 Aug" / "next 01 Aug" / "26 Aug" and came out non-chronological.
  upcoming.sort((a, b) => (a.sortKey ?? "9999-12-31").localeCompare(b.sortKey ?? "9999-12-31"));
  return { openNow, upcoming };
}
