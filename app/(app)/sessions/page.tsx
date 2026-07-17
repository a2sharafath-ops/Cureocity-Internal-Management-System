import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canManageSessions } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import TrainingScheduleView, { type Trainer, type Slot, type AssessmentRow, type RecoveryRow, type ClassRow } from "@/components/TrainingScheduleView";

export const dynamic = "force-dynamic";

const HOURS = Array.from({ length: 9 }, (_, i) => i + 9); // 9am..5pm

export default async function SessionsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/sessions")) redirect("/dashboard");
  const writer = canManageSessions(me.role);
  const today = todayISO();
  const supabase = createClient();

  const [staffR, slotsR, clientsR, assessR, recovR, classesR] = await Promise.all([
    supabase.from("staff").select("id, name, color, is_trainer").order("name"),
    supabase.from("trainer_slots").select("trainer_id, hour, status, client_id, clients(name), tag"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("assessments").select("id, kind, due_date, status, scheduled_date, clients(name), staff:trainer_id(name)").order("due_date", { ascending: false }).limit(60),
    supabase.from("recovery_sessions").select("id, kind, date, hour, status, clients(name), staff:staff_id(name)").gte("date", today).order("date").limit(40),
    supabase.from("classes").select("id, title, date, hour, capacity, staff:trainer_id(name), class_bookings(id)").gte("date", today).order("date").limit(30),
  ]);

  const staffRows = (staffR.data ?? []) as { id: string; name: string; color: string | null; is_trainer: boolean }[];
  const trainers: Trainer[] = staffRows.filter((s) => s.is_trainer).map((s) => ({ id: s.id, name: s.name, color: s.color ?? "#0f766e" }));
  const staff = staffRows.map((s) => ({ id: s.id, name: s.name }));
  const clients = (clientsR.data ?? []) as { id: string; name: string }[];

  const slots: Slot[] = ((slotsR.data ?? []) as unknown as { trainer_id: string; hour: number; status: string; client_id: string | null; clients: { name: string } | null; tag: string | null }[])
    .map((s) => ({ trainer_id: s.trainer_id, hour: s.hour, status: s.status, client_id: s.client_id, clientName: s.clients?.name ?? null, tag: s.tag }));

  const allAssess: AssessmentRow[] = ((assessR.data ?? []) as unknown as { id: string; kind: string; due_date: string; status: string; scheduled_date: string | null; clients: { name: string } | null; staff: { name: string } | null }[])
    .map((a) => ({ id: a.id, kind: a.kind, due_date: a.due_date, status: a.status, scheduled_date: a.scheduled_date, clientName: a.clients?.name ?? null, trainerName: a.staff?.name ?? null }));
  const assessments = allAssess.filter((a) => a.status !== "done").sort((x, y) => x.due_date < y.due_date ? -1 : 1);
  const assessmentRecords = allAssess.filter((a) => a.status === "done").slice(0, 12);

  const recovery: RecoveryRow[] = ((recovR.data ?? []) as unknown as { id: string; kind: string; date: string; hour: number | null; status: string; clients: { name: string } | null; staff: { name: string } | null }[])
    .map((r) => ({ id: r.id, kind: r.kind, date: r.date, hour: r.hour, status: r.status, clientName: r.clients?.name ?? null, staffName: r.staff?.name ?? null }));

  const classes: ClassRow[] = ((classesR.data ?? []) as unknown as { id: string; title: string; date: string; hour: number; capacity: number; staff: { name: string } | null; class_bookings: { id: string }[] }[])
    .map((c) => ({ id: c.id, title: c.title, date: c.date, hour: c.hour, capacity: c.capacity, trainerName: c.staff?.name ?? null, booked: (c.class_bookings ?? []).length }));

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["trainer_slots", "assessments", "recovery_sessions", "classes"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Training Schedule</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>PT trainer slots · fitness assessments · room booking</p>

      <TrainingScheduleView
        today={today} trainers={trainers} hours={HOURS} slots={slots} clients={clients}
        staff={staff} assessments={assessments} assessmentRecords={assessmentRecords} recovery={recovery} classes={classes} canWrite={writer}
      />
    </div>
  );
}
