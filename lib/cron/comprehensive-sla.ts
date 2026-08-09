// Nightly Comprehensive SLA sweep.
//
// Same shape as the BluePrint sweep: load every in-flight protocol, run the
// clocks, skip anyone on a client-side hold, and notify once per gate per kind.
// "Once" is enforced by the unique index on
// (client_id, protocol, gate, kind) — a protocol that stays breached for three
// weeks notifies on the first night and then stays quiet, rather than nagging
// the same manager nightly until someone mutes the whole channel.
//
// The difference from BluePrint is volume: a comp12 client has 15 milestones
// plus 6 turnarounds, so the dedupe matters more here than it did there.

import { comprehensiveSla, OWNER_ROLES, formatLeft, type Gate } from "@/lib/comprehensive-sla";
import {
  COMPREHENSIVE_CATEGORY, milestoneDates, cyclesFor, bookableNow,
  bookingTaskTitle, reassessmentOutOfOrder,
} from "@/lib/comprehensive";
import { loadCatOf, serviceForMilestone } from "@/lib/appt-match";
import { resolvableGates, closeResolvedGates, type OpenGate } from "@/lib/cron/sla-resolve";
import { nudgeLink } from "@/lib/notification-target";
import { notifyRoles } from "@/lib/notify";

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type SlaSweepResult = {
  scanned: number; warnings: number; breaches: number;
  /** booking tasks raised for milestones that just became bookable */
  booked: number;
  /** doctor reviews sitting ahead of an incomplete reassessment */
  outOfOrder: number;
  /** alerts retired because the work behind them is now done */
  resolved: number;
};

const MANAGEMENT = ["Manager", "Administrator", "Super Admin"];

export async function runComprehensiveSla(supabase: Sb, now: number = Date.now()): Promise<SlaSweepResult> {
  const { data: protoRows } = await supabase
    .from("care_protocols")
    .select("client_id, start_date, consolidated_at, approved_at, hold_since, hold_ms")
    .eq("protocol", COMPREHENSIVE_CATEGORY)
    .eq("status", "active");

  const protos = (protoRows ?? []) as {
    client_id: string; start_date: string;
    consolidated_at: string | null; approved_at: string | null;
    hold_since: string | null; hold_ms: number | null;
  }[];
  if (!protos.length) return { scanned: 0, warnings: 0, breaches: 0, booked: 0, outOfOrder: 0, resolved: 0 };

  const ids = protos.map((p) => p.client_id);
  const [
    { data: consults }, { data: clients }, { data: seen },
    { data: charts }, { data: workouts }, { data: rx },
    { data: sessions }, { data: appts }, { data: cps },
  ] = await Promise.all([
    supabase.from("consultations")
      .select("client_id, kind, completed_at, approved_at, prescription_needed").in("client_id", ids),
    supabase.from("clients").select("id, name").in("id", ids),
    supabase.from("blueprint_sla_events")
      // Only alerts still open. A gate that breaks again after being fixed is
      // news, so a resolved row must not go on suppressing the notification.
      .select("client_id, gate, kind").is("resolved_at", null)
      .eq("protocol", COMPREHENSIVE_CATEGORY).in("client_id", ids),
    // The plan is the document now; diet_charts is retired. `created_at` is
    // when the dietitian first saved it — the equivalent of the old drafted_at.
    supabase.from("diet_plans").select("client_id, created_at").in("client_id", ids),
    supabase.from("client_workouts").select("client_id, created_at, plan_weeks").in("client_id", ids),
    supabase.from("prescriptions").select("client_id, shared_at").in("client_id", ids),
    supabase.from("sessions").select("client_id, status, date").in("client_id", ids).eq("status", "completed").order("date"),
    supabase.from("appointments").select("client_id, type, date, status").in("client_id", ids),
    supabase.from("client_packages")
      .select("client_id, package_id, start_date, status").in("client_id", ids).eq("status", "active"),
  ]);

  const nameOf = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const already = new Set(
    ((seen ?? []) as { client_id: string; gate: string; kind: string }[])
      .map((e) => `${e.client_id}|${e.gate}|${e.kind}`),
  );

  /** earliest non-null value per client — the first time the thing happened */
  const earliest = <T extends { client_id: string }>(rows: T[] | null, at: (r: T) => string | null | undefined) => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) {
      const v = at(r);
      if (!v) continue;
      const cur = m.get(r.client_id);
      if (!cur || v < cur) m.set(r.client_id, v);
    }
    return m;
  };

  const byClient = new Map<string, { kind: string; completedAt: string | null; approvedAt: string | null; prescriptionNeeded: boolean | null }[]>();
  for (const c of (consults ?? []) as { client_id: string; kind: string; completed_at: string | null; approved_at: string | null; prescription_needed: boolean | null }[]) {
    const list = byClient.get(c.client_id) ?? [];
    list.push({ kind: c.kind, completedAt: c.completed_at, approvedAt: c.approved_at, prescriptionNeeded: c.prescription_needed });
    byClient.set(c.client_id, list);
  }

  const draftAt = earliest(charts as { client_id: string; created_at: string | null }[], (r) => r.created_at);
  // A plan only counts once it covers at least a week — that's the commitment.
  const planAt = earliest(
    ((workouts ?? []) as { client_id: string; created_at: string; plan_weeks: number | null }[])
      .filter((w) => (w.plan_weeks ?? 1) >= 1),
    (r) => r.created_at,
  );
  const rxAt = earliest(rx as { client_id: string; shared_at: string | null }[], (r) => r.shared_at);

  // Count AND dates: a session block is finished when the last session
  // happened, not when the sweep ran. See comprehensiveSla().
  const sessCount = new Map<string, number>();
  const sessDates = new Map<string, string[]>();
  for (const s of (sessions ?? []) as { client_id: string; date?: string | null }[]) {
    sessCount.set(s.client_id, (sessCount.get(s.client_id) ?? 0) + 1);
    if (s.date) (sessDates.get(s.client_id) ?? sessDates.set(s.client_id, []).get(s.client_id)!).push(s.date);
  }
  // Resolve each booking's type to its service category so a manually-booked
  // service ("10th Day Diet Followup") counts against its milestone / SLA.
  const catOf = await loadCatOf(supabase);
  // The catalogue with day offsets, so each milestone can name the specific
  // service it books — that is what stops the initial consultation and the
  // day-21 review from closing the day-10 follow-up.
  const { data: svcRows } = await supabase.from("services").select("name, category, day_offset");
  const services = (svcRows ?? []) as { name: string; category: string; day_offset: number | null }[];
  const apptsBy = new Map<string, { type: string | null; date: string | null; status: string }[]>();
  for (const a of (appts ?? []) as { client_id: string; type: string | null; date: string | null; status: string }[]) {
    const list = apptsBy.get(a.client_id) ?? [];
    // RAW type, not the resolved category: milestoneSatisfied needs the
    // service name to tell a day-10 follow-up from a day-21 review, and to
    // tell either from the initial consultation.
    list.push({ type: a.type, date: a.date, status: a.status });
    apptsBy.set(a.client_id, list);
  }
  // comp4 = 28 days = 1 cycle; comp12 = 84 = 3. Read from the package the
  // client actually holds rather than assuming.
  const validity = new Map<string, number>();
  for (const cp of (cps ?? []) as { client_id: string; package_id: string }[]) {
    validity.set(cp.client_id, cp.package_id === "comp12" ? 84 : 28);
  }

  const events: { client_id: string; protocol: string; gate: string; kind: string; due_at: string }[] = [];
  // Gates this run found still late or still due. Everything already on the
  // ledger and NOT in here is finished work, and gets retired below — without
  // which the Whiteboard shows a chart that was an hour late as red for the
  // rest of the package, and asks the coach to explain it daily.
  const stillOpen: OpenGate[] = [];
  const newTasks: Record<string, unknown>[] = [];
  let warnings = 0, breaches = 0, booked = 0, outOfOrder = 0;

  // Existing open booking tasks, so a milestone doesn't get re-queued nightly.
  const { data: openTasks } = await supabase.from("tasks")
    .select("client_id, title").in("client_id", ids).neq("status", "done");
  const taskSet = new Set(
    ((openTasks ?? []) as { client_id: string; title: string }[]).map((t) => `${t.client_id}|${t.title}`),
  );
  const today = new Date(now).toISOString().slice(0, 10);

  for (const p of protos) {
    const name = nameOf.get(p.client_id) ?? "A client";
    const report = comprehensiveSla({
      catOf, services, today,
      startDate: p.start_date,
      validityDays: validity.get(p.client_id) ?? 28,
      consults: byClient.get(p.client_id) ?? [],
      dietDraftedAt: draftAt.get(p.client_id) ?? null,
      workoutPlannedAt: planAt.get(p.client_id) ?? null,
      prescriptionSharedAt: rxAt.get(p.client_id) ?? null,
      sessionsCompleted: sessCount.get(p.client_id) ?? 0,
      sessionDates: sessDates.get(p.client_id) ?? [],
      appointments: apptsBy.get(p.client_id) ?? [],
      hold: { holdSince: p.hold_since, holdMs: Number(p.hold_ms ?? 0) },
    }, now);

    // On hold means the delay isn't ours. The clocks are already extended, so
    // anything firing here would be an artefact of a stale deadline.
    if (report.onHold) continue;

    const fire = async (g: Gate, kind: "warning" | "breach") => {
      const key = `${p.client_id}|${g.gate}|${kind}`;
      if (already.has(key) || !g.clock.dueAt) return;
      already.add(key);
      events.push({ client_id: p.client_id, protocol: COMPREHENSIVE_CATEGORY, gate: g.gate, kind, due_at: g.clock.dueAt });
      if (kind === "warning") warnings++; else breaches++;
      // Warnings go only to the person who owes the work — management doesn't
      // need to hear about something still on track to land. Breaches escalate.
      const roles = kind === "breach"
        ? [...OWNER_ROLES[g.owner], ...MANAGEMENT]
        : OWNER_ROLES[g.owner];
      await notifyRoles(supabase, roles, {
        title: kind === "breach" ? `Comprehensive deadline missed — ${name}` : `Comprehensive due soon — ${name}`,
        body: `${g.label} · ${formatLeft(g.clock.msLeft)}`,
        href: `/clients/${p.client_id}`,
        icon: kind === "breach" ? "🔴" : "⏳",
        // Resolve to the actual drafting section (diet chart / workout planner /
        // consolidated summary) at click-time; falls back to the client card.
        link: nudgeLink(g.label, p.client_id),
      });
    };

    for (const g of [...report.turnarounds, ...report.milestones]) {
      const live = g.clock.status === "due_soon" || g.clock.status === "breached";
      if (live) stillOpen.push({ client_id: p.client_id, gate: g.gate });
      if (g.clock.status === "due_soon") await fire(g, "warning");
      if (g.clock.status === "breached") await fire(g, "breach");
    }

    // ---- milestone booking prompts ----------------------------------------
    // Raised when a milestone becomes bookable, not at day 0 — queueing twelve
    // prompts the day someone buys comp12 would be noise, and the day-77 one
    // couldn't be actioned anyway.
    const appts = apptsBy.get(p.client_id) ?? [];
    const cycles = cyclesFor(validity.get(p.client_id) ?? 28);
    const dated = milestoneDates(p.start_date, cycles);
    for (const m of dated) {
      const svc = serviceForMilestone(m.apptType, m.from, services);
      const next = dated.find((o) => o.apptType === m.apptType && o.from === m.from && o.fromDate > m.fromDate);
      if (!bookableNow(m, today, appts, { catOf, service: svc, toDate: next?.fromDate ?? null })) continue;
      const title = bookingTaskTitle(m, name);
      if (taskSet.has(`${p.client_id}|${title}`)) continue;
      taskSet.add(`${p.client_id}|${title}`);
      newTasks.push({
        title, client_id: p.client_id, type: "Ops",
        priority: today >= m.dueDate ? "High" : "Medium",
        status: "todo", due_date: m.dueDate, created_by: "auto",
      });
      booked++;
    }

    // ---- reassessment ordering --------------------------------------------
    // A warning, not a block: the doctor's month-end review is meant to happen
    // after the fitness reassessment so the numbers are current. A clinic with
    // a reason to reverse them shouldn't be stopped, but nobody should do it
    // by accident.
    for (const bad of reassessmentOutOfOrder(p.start_date, cycles, appts)) {
      const gate = `order:doctor_before_reassess#${bad.cycle}`;
      if (already.has(`${p.client_id}|${gate}|warning`)) continue;
      already.add(`${p.client_id}|${gate}|warning`);
      events.push({ client_id: p.client_id, protocol: COMPREHENSIVE_CATEGORY, gate, kind: "warning", due_at: `${bad.doctorDate}T00:00:00Z` });
      outOfOrder++;
      await notifyRoles(supabase, ["Fitness Trainer", ...MANAGEMENT], {
        title: `Reassessment not done — ${name}`,
        body: `Doctor review is booked for ${bad.doctorDate} but the fitness reassessment isn't complete.`,
        href: `/clients/${p.client_id}`,
        icon: "⚠️",
      });
    }
  }

  if (newTasks.length) await supabase.from("tasks").insert(newTasks);

  const resolved = await closeResolvedGates(
    supabase,
    resolvableGates((seen ?? []) as { client_id: string; gate: string }[], stillOpen),
  );

  if (events.length) {
    await supabase.from("blueprint_sla_events")
      .upsert(events, { onConflict: "client_id,protocol,gate,kind", ignoreDuplicates: true });
  }

  return { scanned: protos.length, warnings, breaches, booked, outOfOrder, resolved };
}
