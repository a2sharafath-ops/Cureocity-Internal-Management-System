// Today's agenda for the ops dashboard — everything happening or due *today*,
// in one actionable list, so nothing (a Day-2 diet chart explanation, a strength
// session) slips by unnoticed. Four sources, each normalised to a done/pending
// AgendaItem:
//   • appointments  — consults / assessments / diet-chart-explanation bookings
//   • sessions      — PT & Comprehensive strength sessions
//   • followups     — touchpoints due today (incl. the diet chart explanation)
//   • deadlines     — care milestones (comprehensive + PT) whose date is today
//
// Computed live from bulk reads. Read-only helpers only; actions live in
// lib/actions (markSessionComplete etc.).

import { FOLLOWUP_CLOSED_SQL } from "@/lib/work-owners";
import { createClient } from "@/lib/supabase/server";
import { COMPREHENSIVE_CATEGORY, milestoneDates as compMilestones, cyclesFor as compCycles } from "@/lib/comprehensive";
import { PT_CATEGORY, milestoneDates as ptMilestones, cyclesFor as ptCycles } from "@/lib/pt";
import { unsatisfiedMilestones, currentTerm } from "@/lib/obligations";

export type AgendaKind = "appointment" | "session" | "followup" | "deadline";

export type AgendaItem = {
  id: string;
  kind: AgendaKind;
  clientId: string | null;
  clientName: string;
  label: string;
  time: string | null;      // "9:00 AM" or null when it's an all-day item
  done: boolean;
  overdue: boolean;         // due before today and still open (followups)
  href: string;
  sessionId?: string;       // strength sessions — enables inline "Mark done"
  /** The Health Professional this item belongs to, where one is known.
   *  Every agenda item used to be ownerless, so a shared Today list said what
   *  was happening without ever saying whose it was. */
  ownerId?: string | null;
  ownerName?: string | null;
};

export type Agenda = {
  appointments: AgendaItem[];
  sessions: AgendaItem[];
  followups: AgendaItem[];
  deadlines: AgendaItem[];
  total: number;
  pending: number;
};

function fmtHour(h: number | null): string | null {
  if (h == null) return null;
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

/**
 * @param viewerStaffId When given, the agenda is narrowed to that person's own
 *   day — the items they own. Ops roles pass nothing and see the whole clinic,
 *   which is the point of their dashboard; a Health Professional looking at a
 *   clinic-wide list has to hunt for their own name in it.
 */
export async function todayAgenda(today: string, viewerStaffId?: string | null): Promise<Agenda> {
  const sb = await createClient();

  const [{ data: apptRows }, { data: sessRows }, { data: fuRows }, { data: cps }, { data: clients }, { data: protos }] = await Promise.all([
    sb.from("appointments").select("id, type, hour, date, status, provider_id, staff:provider_id(name), clients(id, name)").eq("date", today).neq("status", "cancelled").order("hour"),
    sb.from("sessions").select("id, hour, date, status, client_id, trainer_id, staff:trainer_id(name), clients(id, name)").eq("date", today).order("hour"),
    // "not done" also caught 'skipped', so a follow-up the client declined
    // showed here as overdue for ever. FOLLOWUP_CLOSED is the shared answer.
    sb.from("followups").select("id, client_id, label, due_date, status, clients(id, name)").lte("due_date", today).not("status", "in", FOLLOWUP_CLOSED_SQL).order("due_date"),
    sb.from("client_packages").select("client_id, category, start_date, end_date, status").eq("status", "active").in("category", [COMPREHENSIVE_CATEGORY, PT_CATEGORY]),
    sb.from("clients").select("id, name"),
    sb.from("care_protocols").select("client_id, protocol, start_date, status").eq("status", "active"),
  ]);

  const nameOf = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // ---- appointments today ----------------------------------------------------
  let appointments: AgendaItem[] = ((apptRows ?? []) as unknown as { id: string; type: string | null; hour: number | null; status: string; provider_id: string | null; staff: { name: string } | null; clients: { id: string; name: string } | null }[]).map((a) => ({
    id: a.id, kind: "appointment", clientId: a.clients?.id ?? null, clientName: a.clients?.name ?? "—",
    label: a.type ?? "Appointment", time: fmtHour(a.hour), done: a.status === "completed", overdue: false,
    href: a.clients?.id ? `/appointments?client=${a.clients.id}` : "/appointments",
    ownerId: a.provider_id, ownerName: a.staff?.name ?? null,
  }));

  // ---- strength sessions today ----------------------------------------------
  let sessions: AgendaItem[] = ((sessRows ?? []) as unknown as { id: string; hour: number | null; status: string; client_id: string | null; trainer_id: string | null; staff: { name: string } | null; clients: { id: string; name: string } | null }[]).map((s) => ({
    id: s.id, kind: "session", clientId: s.clients?.id ?? s.client_id ?? null, clientName: s.clients?.name ?? "—",
    label: "Strength session", time: fmtHour(s.hour), done: s.status === "completed", overdue: false,
    href: s.clients?.id ? `/clients/${s.clients.id}` : "/trainer", sessionId: s.id,
    ownerId: s.trainer_id, ownerName: s.staff?.name ?? null,
  }));

  // ---- follow-ups due today (and missed ones still open) --------------------
  const followups: AgendaItem[] = ((fuRows ?? []) as unknown as { id: string; client_id: string | null; label: string | null; due_date: string; status: string; clients: { id: string; name: string } | null }[]).map((f) => ({
    id: f.id, kind: "followup", clientId: f.clients?.id ?? f.client_id ?? null, clientName: f.clients?.name ?? "—",
    label: f.label ?? "Follow-up", time: null, done: false, overdue: f.due_date < today,
    href: f.clients?.id ? `/followups?client=${f.clients.id}` : "/followups",
  }));

  // ---- care milestones whose calendar date is today -------------------------
  // (Reassessments / review milestones that are due today but not yet booked.)
  const protoBy = new Map<string, { protocol?: string | null; start_date: string | null }[]>();
  for (const r of (protos ?? []) as { client_id: string; protocol: string | null; start_date: string | null }[]) {
    (protoBy.get(r.client_id) ?? protoBy.set(r.client_id, []).get(r.client_id)!).push(r);
  }
  const milestoneClientIds = Array.from(new Set(((cps ?? []) as { client_id: string }[]).map((c) => c.client_id)));
  let apptsByClient = new Map<string, { type: string | null; date: string | null; status: string }[]>();
  if (milestoneClientIds.length) {
    const { data: allAppts } = await sb.from("appointments").select("client_id, type, date, status").in("client_id", milestoneClientIds).neq("status", "cancelled");
    for (const a of (allAppts ?? []) as { client_id: string; type: string | null; date: string | null; status: string }[]) {
      (apptsByClient.get(a.client_id) ?? apptsByClient.set(a.client_id, []).get(a.client_id)!).push(a);
    }
  }

  const { data: svcData } = await sb.from("services").select("name, category, day_offset");
  const services = (svcData ?? []) as { name: string; category: string; day_offset: number | null }[];
  const deadlines: AgendaItem[] = [];
  // ONE term per client, not one per package row.
  //
  // This looped over every active package, so a renewed client — whose old row
  // stays active alongside the new one — had their entire milestone set listed
  // twice on the agenda, dated from two different starts.
  const pkgBy = new Map<string, { category: string; start_date: string | null; end_date: string | null }[]>();
  for (const cp of (cps ?? []) as { client_id: string; category: string; start_date: string | null; end_date: string | null }[]) {
    (pkgBy.get(cp.client_id) ?? pkgBy.set(cp.client_id, []).get(cp.client_id)!).push(cp);
  }
  for (const [clientId, pkgs] of pkgBy) {
    const term = currentTerm(pkgs, protoBy.get(clientId) ?? [], today);
    if (!term) continue;
    const start = term.anchor;
    const clientAppts = apptsByClient.get(clientId) ?? [];
    const dated = term.category === PT_CATEGORY
      ? ptMilestones(start, ptCycles(term.spanDays))
      : compMilestones(start, compCycles(term.spanDays));
    // Shared satisfied-check + Book link; we only surface milestones due *today*.
    for (const m of unsatisfiedMilestones(clientId, dated, clientAppts, services, today)) {
      if (m.dueDate !== today) continue;
      deadlines.push({
        id: `${clientId}-${m.gate}`, kind: "deadline", clientId, clientName: nameOf.get(clientId) ?? "—",
        label: `${m.label} due`, time: null, done: false, overdue: false,
        href: m.bookHref,
      });
    }
  }

  // Items with no owner (follow-ups, unbooked milestones) stay visible to
  // everyone: they are precisely the work that has not been picked up yet, and
  // hiding them from the person best placed to act would be the wrong default.
  const mine = <T extends AgendaItem>(rows: T[]): T[] =>
    viewerStaffId ? rows.filter((r) => !r.ownerId || r.ownerId === viewerStaffId) : rows;
  appointments = mine(appointments);
  sessions = mine(sessions);

  const all = [...appointments, ...sessions, ...followups, ...deadlines];
  return {
    appointments, sessions, followups, deadlines,
    total: all.length,
    pending: all.filter((i) => !i.done).length,
  };
}
