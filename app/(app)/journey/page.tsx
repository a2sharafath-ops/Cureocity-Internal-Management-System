import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canEditAppointments } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import LiveJourneyBoard, { type BoardRow } from "@/components/LiveJourneyBoard";
import { journeyKpis, isCoachNotified, type JourneyEvent } from "@/lib/live-journey";

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
  clients: { name: string } | null;
};

export default async function JourneyPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/journey")) redirect("/dashboard");

  const supabase = await createClient();
  const [journeysR, eventsR, staffR] = await Promise.all([
    supabase
      .from("journeys")
      .select("id, client_id, walk_in_name, walk_in_phone, goal, source, concerns, coach_id, stage, status, stage_entered_at, clients(name)")
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase.from("journey_events").select("journey_id, kind, stage, at"),
    supabase.from("staff").select("id, name, role").order("name"),
  ]);

  const journeys = (journeysR.data ?? []) as unknown as JourneyDB[];
  const events = (eventsR.data ?? []) as JourneyEvent[];
  const staff = (staffR.data ?? []) as { id: string; name: string; role: string | null }[];
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const coaches = staff.filter((s) => s.role === "Health Coach");

  const nowMs = Date.now();
  const kpis = journeyKpis(
    journeys.map((j) => ({ id: j.id, stage: j.stage, status: j.status, stage_entered_at: j.stage_entered_at })),
    events,
    nowMs,
  );

  const rows: BoardRow[] = journeys.map((j) => ({
    id: j.id,
    name: j.clients?.name ?? j.walk_in_name ?? "Walk-in",
    phone: j.walk_in_phone,
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
        coaches={coaches.map((c) => ({ id: c.id, name: c.name }))}
        canCoordinate={canEditAppointments(me.role)}
      />
    </>
  );
}
