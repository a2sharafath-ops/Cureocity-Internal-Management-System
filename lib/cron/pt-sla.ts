// Nightly PT sweep — the trainer-track counterpart of the Comprehensive sweep,
// trimmed to what a PT package actually commits to:
//
//   • raise a booking task when the fitness reassessment becomes bookable
//     (day 21), due by day 28, once per cycle;
//   • flag, once, a package that was bought but never scheduled at all;
//   • flag, once, any cycle whose 12 strength sessions aren't complete by the
//     cycle deadline.
//
// Dedupe: booking tasks are matched by title against open tasks; the
// session-overdue notice is deduped through blueprint_sla_events on
// (client_id, protocol, gate, kind), so a lagging cycle nags once, not nightly.

import {
  PT_CATEGORY, milestoneDates, cyclesFor, bookableNow, bookingTaskTitle,
  ptDeadline, PT_SESSIONS_PER_CYCLE, BOOKING_DUE_DAYS, CYCLE_DAYS, addDaysISO,
} from "@/lib/pt";
import { loadCatOf, serviceForMilestone } from "@/lib/appt-match";
import { notifyRoles } from "@/lib/notify";

type Sb = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type PtSweepResult = { scanned: number; booked: number; overdueSessions: number; unbooked: number };

const MANAGEMENT = ["Manager", "Administrator", "Super Admin"];

export async function runPtSla(supabase: Sb, now: number = Date.now()): Promise<PtSweepResult> {
  const today = new Date(now).toISOString().slice(0, 10);

  const { data: protoRows } = await supabase
    .from("care_protocols")
    .select("client_id, start_date, hold_since")
    .eq("protocol", PT_CATEGORY)
    .eq("status", "active");
  const protos = (protoRows ?? []) as { client_id: string; start_date: string; hold_since: string | null }[];
  if (!protos.length) return { scanned: 0, booked: 0, overdueSessions: 0, unbooked: 0 };

  const ids = protos.map((p) => p.client_id);
  const [{ data: clients }, { data: apptRows }, { data: sessRows }, { data: taskRows }, { data: cpRows }, { data: seenRows }] =
    await Promise.all([
      supabase.from("clients").select("id, name").in("id", ids),
      supabase.from("appointments").select("client_id, type, date, status").in("client_id", ids),
      supabase.from("sessions").select("client_id, status").in("client_id", ids),
      supabase.from("tasks").select("client_id, title").in("client_id", ids).neq("status", "done"),
      supabase.from("client_packages").select("client_id, package_id").in("client_id", ids).eq("category", PT_CATEGORY),
      supabase.from("blueprint_sla_events").select("client_id, gate, kind").eq("protocol", PT_CATEGORY).in("client_id", ids),
    ]);

  const nameOf = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // validity (days) per client, to know how many 28-day cycles the package runs
  const cps = (cpRows ?? []) as { client_id: string; package_id: string | null }[];
  const pkgIds = [...new Set(cps.map((c) => c.package_id).filter(Boolean) as string[])];
  const { data: pkgRows } = pkgIds.length
    ? await supabase.from("packages").select("id, validity").in("id", pkgIds)
    : { data: [] };
  const validityByPkg = new Map(((pkgRows ?? []) as { id: string; validity: number }[]).map((p) => [p.id, p.validity]));
  const validityByClient = new Map(cps.map((c) => [c.client_id, (c.package_id && validityByPkg.get(c.package_id)) || 28]));

  // Resolve each booking's type to its service category so a manually-booked
  // service ("Fitness Reassessment") counts against its milestone.
  const catOf = await loadCatOf(supabase);
  // The catalogue with day offsets, so each milestone can name the specific
  // service it books — that is what stops the initial consultation and the
  // day-21 review from closing the day-10 follow-up.
  const { data: svcRows } = await supabase.from("services").select("name, category, day_offset");
  const services = (svcRows ?? []) as { name: string; category: string; day_offset: number | null }[];
  const apptsBy = new Map<string, { type: string | null; date: string | null; status: string }[]>();
  for (const a of (apptRows ?? []) as { client_id: string; type: string | null; date: string | null; status: string }[]) {
    // RAW type, not the resolved category — the matcher needs the service name
    // to tell a reassessment from the initial fitness consultation.
    (apptsBy.get(a.client_id) ?? apptsBy.set(a.client_id, []).get(a.client_id)!).push({ ...a });
  }
  const doneSessions = new Map<string, number>();
  // Booked-or-not is a different question from done-or-not. The cycle breach
  // below counts completed sessions, which cannot distinguish "booked twelve,
  // attended none" from "never booked anything" — and those need different
  // people chasing different things.
  const anySessions = new Map<string, number>();
  for (const s of (sessRows ?? []) as { client_id: string; status: string }[]) {
    anySessions.set(s.client_id, (anySessions.get(s.client_id) ?? 0) + 1);
    if (s.status === "completed") doneSessions.set(s.client_id, (doneSessions.get(s.client_id) ?? 0) + 1);
  }
  const openTaskTitles = new Set(((taskRows ?? []) as { client_id: string; title: string }[]).map((t) => `${t.client_id}|${t.title}`));
  const seen = new Set(((seenRows ?? []) as { client_id: string; gate: string; kind: string }[]).map((e) => `${e.client_id}|${e.gate}|${e.kind}`));

  const newTasks: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  let booked = 0, overdueSessions = 0, unbooked = 0;

  for (const p of protos) {
    // Client-side hold pauses the clocks — don't prompt or flag a paused client
    // (mirrors the Comprehensive sweep).
    if (p.hold_since) continue;
    const name = nameOf.get(p.client_id) ?? "Client";
    const appts = apptsBy.get(p.client_id) ?? [];
    const cycles = cyclesFor(validityByClient.get(p.client_id) ?? 28);

    // ---- reassessment booking prompts (per cycle) -------------------------
    const dated = milestoneDates(p.start_date, cycles);
    for (const m of dated) {
      const svc = serviceForMilestone(m.apptType, m.from, services);
      const next = dated.find((o) => o.apptType === m.apptType && o.from === m.from && o.fromDate > m.fromDate);
      if (!bookableNow(m, today, appts, { catOf, service: svc, toDate: next?.fromDate ?? null })) continue;
      const title = bookingTaskTitle(m, name);
      if (openTaskTitles.has(`${p.client_id}|${title}`)) continue;
      openTaskTitles.add(`${p.client_id}|${title}`);
      newTasks.push({
        title, client_id: p.client_id, type: "Ops",
        priority: today >= m.dueDate ? "High" : "Medium",
        status: "todo", due_date: m.dueDate, created_by: "auto",
      });
      booked++;
    }

    // ---- package bought but never scheduled -------------------------------
    // Caught here rather than at the 28-day breach, which is four weeks too
    // late to save the block. Fires once per client, at the booking deadline.
    if ((anySessions.get(p.client_id) ?? 0) === 0) {
      const bookBy = addDaysISO(p.start_date, BOOKING_DUE_DAYS);
      if (today >= bookBy && !seen.has(`${p.client_id}|sessions_unbooked|breach`)) {
        seen.add(`${p.client_id}|sessions_unbooked|breach`);
        events.push({ client_id: p.client_id, protocol: PT_CATEGORY, gate: "sessions_unbooked", kind: "breach", due_at: `${bookBy}T00:00:00Z` });
        unbooked++;
        await notifyRoles(supabase, ["Front Desk", "Fitness Trainer", ...MANAGEMENT], {
          title: `No sessions booked — ${name}`,
          body: `Package started ${p.start_date}; nothing in the diary. The ${CYCLE_DAYS}-day window is already running.`,
          href: `/clients/${p.client_id}`,
          icon: "📭",
        });
      }
    }

    // ---- session-cycle deadline -------------------------------------------
    const done = doneSessions.get(p.client_id) ?? 0;
    for (let cycle = 1; cycle <= cycles; cycle++) {
      const deadline = ptDeadline(p.start_date, cycle);
      if (today < deadline) break;                                  // future cycles not due yet
      if (done >= PT_SESSIONS_PER_CYCLE * cycle) continue;          // this cycle's quota met
      const gate = cycles > 1 ? `sessions#${cycle}` : "sessions";
      if (seen.has(`${p.client_id}|${gate}|breach`)) continue;
      seen.add(`${p.client_id}|${gate}|breach`);
      events.push({ client_id: p.client_id, protocol: PT_CATEGORY, gate, kind: "breach", due_at: `${deadline}T00:00:00Z` });
      overdueSessions++;
      await notifyRoles(supabase, ["Fitness Trainer", ...MANAGEMENT], {
        title: `PT sessions behind — ${name}`,
        body: `Cycle ${cycle}: ${done}/${PT_SESSIONS_PER_CYCLE * cycle} strength sessions done by the ${deadline} deadline.`,
        href: `/clients/${p.client_id}`,
        icon: "🏋️",
      });
    }
  }

  if (newTasks.length) await supabase.from("tasks").insert(newTasks);
  if (events.length) {
    await supabase.from("blueprint_sla_events")
      .upsert(events, { onConflict: "client_id,protocol,gate,kind", ignoreDuplicates: true });
  }

  return { scanned: protos.length, booked, overdueSessions, unbooked };
}
