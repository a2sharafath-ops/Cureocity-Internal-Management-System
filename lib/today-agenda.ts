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

import { createClient } from "@/lib/supabase/server";
import { COMPREHENSIVE_CATEGORY, milestoneDates as compMilestones, cyclesFor as compCycles } from "@/lib/comprehensive";
import { PT_CATEGORY, milestoneDates as ptMilestones, cyclesFor as ptCycles } from "@/lib/pt";
import { unsatisfiedMilestones } from "@/lib/obligations";

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

export async function todayAgenda(today: string): Promise<Agenda> {
  const sb = createClient();

  const [{ data: apptRows }, { data: sessRows }, { data: fuRows }, { data: cps }, { data: clients }, { data: protos }] = await Promise.all([
    sb.from("appointments").select("id, type, hour, date, status, clients(id, name)").eq("date", today).neq("status", "cancelled").order("hour"),
    sb.from("sessions").select("id, hour, date, status, client_id, clients(id, name)").eq("date", today).order("hour"),
    sb.from("followups").select("id, client_id, label, due_date, status, clients(id, name)").lte("due_date", today).neq("status", "done").order("due_date"),
    sb.from("client_packages").select("client_id, category, start_date, end_date, status").eq("status", "active").in("category", [COMPREHENSIVE_CATEGORY, PT_CATEGORY]),
    sb.from("clients").select("id, name"),
    sb.from("care_protocols").select("client_id, start_date, status").eq("status", "active"),
  ]);

  const nameOf = new Map(((clients ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // ---- appointments today ----------------------------------------------------
  const appointments: AgendaItem[] = ((apptRows ?? []) as unknown as { id: string; type: string | null; hour: number | null; status: string; clients: { id: string; name: string } | null }[]).map((a) => ({
    id: a.id, kind: "appointment", clientId: a.clients?.id ?? null, clientName: a.clients?.name ?? "—",
    label: a.type ?? "Appointment", time: fmtHour(a.hour), done: a.status === "completed", overdue: false,
    href: a.clients?.id ? `/appointments?client=${a.clients.id}` : "/appointments",
  }));

  // ---- strength sessions today ----------------------------------------------
  const sessions: AgendaItem[] = ((sessRows ?? []) as unknown as { id: string; hour: number | null; status: string; client_id: string | null; clients: { id: string; name: string } | null }[]).map((s) => ({
    id: s.id, kind: "session", clientId: s.clients?.id ?? s.client_id ?? null, clientName: s.clients?.name ?? "—",
    label: "Strength session", time: fmtHour(s.hour), done: s.status === "completed", overdue: false,
    href: s.clients?.id ? `/clients/${s.clients.id}` : "/trainer", sessionId: s.id,
  }));

  // ---- follow-ups due today (and missed ones still open) --------------------
  const followups: AgendaItem[] = ((fuRows ?? []) as unknown as { id: string; client_id: string | null; label: string | null; due_date: string; status: string; clients: { id: string; name: string } | null }[]).map((f) => ({
    id: f.id, kind: "followup", clientId: f.clients?.id ?? f.client_id ?? null, clientName: f.clients?.name ?? "—",
    label: f.label ?? "Follow-up", time: null, done: false, overdue: f.due_date < today,
    href: f.clients?.id ? `/followups?client=${f.clients.id}` : "/followups",
  }));

  // ---- care milestones whose calendar date is today -------------------------
  // (Reassessments / review milestones that are due today but not yet booked.)
  const protoStart = new Map(((protos ?? []) as { client_id: string; start_date: string | null }[]).map((r) => [r.client_id, r.start_date]));
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
  for (const cp of (cps ?? []) as { client_id: string; category: string; start_date: string | null; end_date: string | null }[]) {
    const start = protoStart.get(cp.client_id) ?? cp.start_date;
    if (!start) continue;
    const clientAppts = apptsByClient.get(cp.client_id) ?? [];
    const spanDays = cp.end_date ? Math.max(28, Math.round((Date.parse(`${cp.end_date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)) : 28;
    const dated = cp.category === PT_CATEGORY
      ? ptMilestones(start, ptCycles(spanDays))
      : compMilestones(start, compCycles(spanDays));
    // Shared satisfied-check + Book link; we only surface milestones due *today*.
    for (const m of unsatisfiedMilestones(cp.client_id, dated, clientAppts, services)) {
      if (m.dueDate !== today) continue;
      deadlines.push({
        id: `${cp.client_id}-${m.gate}`, kind: "deadline", clientId: cp.client_id, clientName: nameOf.get(cp.client_id) ?? "—",
        label: `${m.label} due`, time: null, done: false, overdue: false,
        href: m.bookHref,
      });
    }
  }

  const all = [...appointments, ...sessions, ...followups, ...deadlines];
  return {
    appointments, sessions, followups, deadlines,
    total: all.length,
    pending: all.filter((i) => !i.done).length,
  };
}
