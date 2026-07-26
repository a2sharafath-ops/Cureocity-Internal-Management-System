import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { loadClientStatuses, clientStatus, disciplineForRole, type ClientStatus } from "@/lib/client-status";
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
    supabase.from("assessments").select("id, kind, due_date, status, scheduled_date, shared, client_id, clients(name), staff:trainer_id(name)").order("due_date", { ascending: false }).limit(60),
    supabase.from("recovery_sessions").select("id, kind, date, hour, status, clients(name), staff:staff_id(name)").gte("date", today).order("date").limit(40),
    supabase.from("classes").select("id, title, date, hour, capacity, staff:trainer_id(name), class_bookings(id)").gte("date", today).order("date").limit(30),
  ]);

  const staffRows = (staffR.data ?? []) as { id: string; name: string; color: string | null; is_trainer: boolean }[];
  const trainers: Trainer[] = staffRows.filter((s) => s.is_trainer).map((s) => ({ id: s.id, name: s.name, color: s.color ?? "#e11f34" }));
  const staff = staffRows.map((s) => ({ id: s.id, name: s.name }));
  const clients = (clientsR.data ?? []) as { id: string; name: string }[];

  const manualSlots: Slot[] = ((slotsR.data ?? []) as unknown as { trainer_id: string; hour: number; status: string; client_id: string | null; clients: { name: string } | null; tag: string | null }[])
    .map((s) => ({ trainer_id: s.trainer_id, hour: s.hour, status: s.status, client_id: s.client_id, clientName: s.clients?.name ?? null, tag: s.tag }));

  // Bridge: overlay this week's REAL bookings (trainer fitness assessments from
  // the appointment calendar + PT strength sessions) onto the recurring grid, so
  // a client scheduled anywhere shows up in that trainer's cell automatically.
  const trainerIds = new Set(trainers.map((t) => t.id));
  const wk0 = new Date(today + "T00:00:00Z");
  const dow = (wk0.getUTCDay() + 6) % 7;                       // 0 = Monday
  const weekStart = new Date(wk0); weekStart.setUTCDate(wk0.getUTCDate() - dow);
  const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const wkStart = weekStart.toISOString().slice(0, 10);
  const wkEnd = weekEnd.toISOString().slice(0, 10);
  const dayAbbr = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

  const [apptWkR, sessWkR] = await Promise.all([
    supabase.from("appointments").select("hour, date, status, type, title, provider_id, client_id, clients(name)").gte("date", wkStart).lte("date", wkEnd).neq("status", "cancelled"),
    supabase.from("sessions").select("hour, date, status, trainer_id, client_id, clients(name)").gte("date", wkStart).lte("date", wkEnd).neq("status", "cancelled"),
  ]);

  const bookings: (Slot & { date: string })[] = [];
  for (const a of (apptWkR.data ?? []) as unknown as { hour: number | null; date: string; type: string | null; title: string | null; provider_id: string | null; client_id: string | null; clients: { name: string } | null }[]) {
    if (!a.provider_id || !trainerIds.has(a.provider_id) || a.hour == null) continue;
    const tag = /re-?assess/i.test(`${a.type ?? ""} ${a.title ?? ""}`) ? "Re-assessment" : "Initial Assessment";
    bookings.push({ trainer_id: a.provider_id, hour: a.hour, status: "assigned", client_id: a.client_id, clientName: a.clients?.name ?? null, tag, booked: true, day: dayAbbr(a.date), date: a.date });
  }
  for (const s of (sessWkR.data ?? []) as unknown as { hour: number | null; date: string; trainer_id: string | null; client_id: string | null; clients: { name: string } | null }[]) {
    if (!s.trainer_id || !trainerIds.has(s.trainer_id) || s.hour == null) continue;
    bookings.push({ trainer_id: s.trainer_id, hour: s.hour, status: "assigned", client_id: s.client_id, clientName: s.clients?.name ?? null, tag: "PT", booked: true, day: dayAbbr(s.date), date: s.date });
  }

  // Manual trainer_slots win a cell; otherwise the earliest booking fills it.
  const slots: Slot[] = [...manualSlots];
  const taken = new Set(manualSlots.map((s) => `${s.trainer_id}|${s.hour}`));
  bookings.sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const b of bookings) {
    const key = `${b.trainer_id}|${b.hour}`;
    if (taken.has(key)) continue;
    taken.add(key);
    slots.push({ trainer_id: b.trainer_id, hour: b.hour, status: b.status, client_id: b.client_id, clientName: b.clientName, tag: b.tag, booked: true, day: b.day });
  }

  const allAssess: AssessmentRow[] = ((assessR.data ?? []) as unknown as { id: string; kind: string; due_date: string; status: string; scheduled_date: string | null; shared: boolean; client_id: string | null; clients: { name: string } | null; staff: { name: string } | null }[])
    .map((a) => ({ id: a.id, kind: a.kind, due_date: a.due_date, status: a.status, scheduled_date: a.scheduled_date, shared: a.shared, client_id: a.client_id, clientName: a.clients?.name ?? null, trainerName: a.staff?.name ?? null }));
  const assessments = allAssess.filter((a) => a.status !== "done").sort((x, y) => x.due_date < y.due_date ? -1 : 1);
  const assessmentRecords = allAssess.filter((a) => a.status === "done").slice(0, 12);

  const recovery: RecoveryRow[] = ((recovR.data ?? []) as unknown as { id: string; kind: string; date: string; hour: number | null; status: string; clients: { name: string } | null; staff: { name: string } | null }[])
    .map((r) => ({ id: r.id, kind: r.kind, date: r.date, hour: r.hour, status: r.status, clientName: r.clients?.name ?? null, staffName: r.staff?.name ?? null }));

  const classes: ClassRow[] = ((classesR.data ?? []) as unknown as { id: string; title: string; date: string; hour: number; capacity: number; staff: { name: string } | null; class_bookings: { id: string }[] }[])
    .map((c) => ({ id: c.id, title: c.title, date: c.date, hour: c.hour, capacity: c.capacity, trainerName: c.staff?.name ?? null, booked: (c.class_bookings ?? []).length }));

  // Role-aware client status for the schedule's clients (slots + assessments).
  const statusIds = Array.from(new Set([...slots.map((s) => s.client_id), ...allAssess.map((a) => a.client_id)].filter(Boolean))) as string[];
  const statusMap = await loadClientStatuses(supabase, statusIds, today);
  const statusDisc = disciplineForRole(me.role);
  const statusByClient: Record<string, ClientStatus> = {};
  for (const id of statusIds) statusByClient[id] = clientStatus(statusMap.get(id), statusDisc);

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["trainer_slots", "assessments", "recovery_sessions", "classes", "appointments", "sessions"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Training Schedule</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>PT trainer slots · fitness assessments · room booking</p>

      <TrainingScheduleView
        today={today} trainers={trainers} hours={HOURS} slots={slots} clients={clients}
        staff={staff} assessments={assessments} assessmentRecords={assessmentRecords} recovery={recovery} classes={classes} canWrite={writer}
        statusByClient={statusByClient}
      />
    </div>
  );
}
