import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canEditAppointments } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import LiveJourneyBoard, { type BoardRow } from "@/components/LiveJourneyBoard";
import { journeyKpis, isCoachNotified, journeyGroup, type JourneyEvent } from "@/lib/live-journey";
import { todayISO } from "@/lib/today";

// `todayISO` comes from lib/today — this page had its own server-local copy,
// which on Vercel is UTC and so ran the clinic day five and a half hours late.

export const dynamic = "force-dynamic";

type JourneyDB = {
  id: string;
  client_id: string | null;
  walk_in_name: string | null;
  walk_in_phone: string | null;
  goal: string | null;
  source: string | null;
  concerns: string | null;
  coach_id: string | null;
  stage: string;
  status: string;
  stage_entered_at: string;
  clients: { name: string; goals: string[] | null } | null;
};

export default async function JourneyPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/journey")) redirect("/dashboard");

  const supabase = await createClient();
  const today = todayISO();
  const [journeysR, eventsR, staffR, apptR] = await Promise.all([
    supabase
      .from("journeys")
      .select("id, client_id, walk_in_name, walk_in_phone, goal, source, concerns, coach_id, stage, status, stage_entered_at, clients(name, goals)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase.from("journey_events").select("journey_id, kind, stage, at"),
    supabase.from("staff").select("id, name, role").order("name"),
    // Who is due on the floor. A client still at Front Desk counts as "here"
    // only if an assessment is actually booked for today; otherwise they were
    // sold a package and haven't come in yet.
    supabase.from("appointments").select("client_id, date")
      .neq("status", "cancelled").not("client_id", "is", null).gte("date", today),
  ]);

  const journeys = (journeysR.data ?? []) as unknown as JourneyDB[];
  const events = (eventsR.data ?? []) as JourneyEvent[];
  const staff = (staffR.data ?? []) as { id: string; name: string; role: string | null }[];
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  const nowMs = Date.now();

  // Clients with a booking today, and — for the ones who aren't here yet — the
  // next date they ARE expected, so the board can say when rather than just
  // "not today".
  const appts = (apptR.data ?? []) as { client_id: string | null; date: string }[];
  const dueToday = new Set<string>();
  const nextVisit = new Map<string, string>();
  for (const a of appts) {
    if (!a.client_id) continue;
    if (a.date === today) dueToday.add(a.client_id);
    const seen = nextVisit.get(a.client_id);
    if (!seen || a.date < seen) nextVisit.set(a.client_id, a.date);
  }

  const groupOf = (j: JourneyDB) =>
    journeyGroup(j, j.client_id ? dueToday.has(j.client_id) : false, nowMs);

  // Only the people actually on the floor are measured. A client who was sold a
  // package last week, or who went home mid-flow, must not drag the
  // three-minute standard down for a day they were never being served on.
  const kpis = journeyKpis(
    journeys
      .filter((j) => groupOf(j) === "here")
      .map((j) => ({ id: j.id, stage: j.stage, status: j.status, stage_entered_at: j.stage_entered_at })),
    events,
    nowMs,
  );

  const rows: BoardRow[] = journeys.map((j) => ({
    id: j.id,
    name: j.clients?.name ?? j.walk_in_name ?? "Walk-in",
    phone: j.walk_in_phone,
    group: groupOf(j),
    expectedOn: j.client_id ? nextVisit.get(j.client_id) ?? null : null,
    // The goal the intake / CRM already captured on the client record. The
    // handover form falls back to this so the coach isn't retyping something
    // the client has already told us once. clients.goals is a list; the board
    // shows it as one comma-separated line.
    clientGoal: (j.clients?.goals ?? []).filter(Boolean).join(", ") || null,
    goal: j.goal,
    source: j.source,
    concerns: j.concerns,
    coachName: j.coach_id ? staffName.get(j.coach_id) ?? null : null,
    stage: j.stage,
    status: j.status,
    stageEnteredAt: j.stage_entered_at,
    notified: isCoachNotified(
      { id: j.id, stage: j.stage, status: j.status, stage_entered_at: j.stage_entered_at },
      events,
    ),
  }));

  return (
    <>
      <RealtimeRefresh tables={["journeys", "journey_events"]} />
      <LiveJourneyBoard
        rows={rows}
        kpis={kpis}
        canCoordinate={canEditAppointments(me.role)}
      />
    </>
  );
}
