import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { loadClientStatuses, clientStatus, disciplineForRole, type ClientStatus } from "@/lib/client-status";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import AppointmentsView, { type ViewAppt, type Provider, type Unsched } from "@/components/AppointmentsView";

export const dynamic = "force-dynamic";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am..9pm
function addDays(iso: string, days: number) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function mondayOf(iso: string) { const d = new Date(iso + "T00:00:00Z"); const dow = (d.getUTCDay() + 6) % 7; return addDays(iso, -dow); }

type Appt = { id: string; client_id: string; type: string | null; title: string | null; date: string; hour: number; duration_min: number; status: string; provider_id: string | null; clients: { id: string; name: string } | null; staff: { name: string } | null };
type StaffRow = { id: string; name: string; designation: string | null; department: string | null; color: string | null; is_trainer: boolean };

// Map a care-team member to a booking discipline.
function disciplineOf(s: StaffRow): string {
  const t = `${s.designation ?? ""} ${s.department ?? ""}`.toLowerCase();
  if (t.includes("doctor") || t.includes("physician")) return "Doctor";
  if (t.includes("diet") || t.includes("nutrition")) return "Dietitian";
  if (t.includes("psych")) return "Psychologist";
  if (t.includes("coach")) return "Health Coach";
  if (s.is_trainer || t.includes("trainer") || t.includes("fitness")) return "Fitness Trainer";
  return "Other";
}

export default async function AppointmentsPage({ searchParams }: { searchParams: { week?: string; client?: string; disc?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/appointments")) redirect("/dashboard");

  const offset = Number(searchParams.week) || 0;
  const today = todayISO();
  const weekStart = addDays(mondayOf(today), offset * 7);
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const supabase = createClient();
  const [apptsR, clientsR, staffR, tasksR, assignsR] = await Promise.all([
    supabase.from("appointments").select("id, client_id, type, title, date, hour, duration_min, status, provider_id, clients(id, name), staff(name)").gte("date", weekStart).lte("date", weekEnd).order("hour"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("staff").select("id, name, designation, department, color, is_trainer").order("name"),
    // Open "Book …" tasks = appointments that are due but not yet on the diary.
    supabase.from("tasks").select("id, client_id, title, due_date").neq("status", "done").ilike("title", "Book %").order("due_date").limit(2000),
    supabase.from("client_assignments").select("client_id, discipline, staff_id"),
  ]);
  const raw = (apptsR.data ?? []) as unknown as Appt[];
  const clients = (clientsR.data ?? []) as { id: string; name: string }[];
  const staffRows = (staffR.data ?? []) as StaffRow[];
  const staffName = new Map(staffRows.map((s) => [s.id, s.name]));

  // Assigned care-team clinician per client per discipline — the "Owner" shown
  // against each due item, matched to the item's discipline.
  const assignByClient = new Map<string, Record<string, string>>();
  for (const a of (assignsR.data ?? []) as { client_id: string; discipline: string; staff_id: string | null }[]) {
    if (!a.staff_id) continue;
    const rec = assignByClient.get(a.client_id) ?? {};
    rec[a.discipline] = a.staff_id;
    assignByClient.set(a.client_id, rec);
  }
  const DISC_KEY: Record<string, string> = { Doctor: "doctor", Dietitian: "dietitian", Psychologist: "psychologist", "Health Coach": "coach", "Fitness Trainer": "trainer" };
  const CATEGORY_OF: Record<string, string> = { Doctor: "Doctor Consultation", Dietitian: "Diet Consultation", Psychologist: "Counselling", "Health Coach": "Coaching", "Fitness Trainer": "Fitness Services" };

  // Providers = care-team members that map to a booking discipline.
  const providers: Provider[] = staffRows
    .map((s) => ({ id: s.id, name: s.name, color: s.color ?? "#e11f34", discipline: disciplineOf(s) }))
    .filter((p) => p.discipline !== "Other");

  const appts: ViewAppt[] = raw.map((a) => ({
    id: a.id, client_id: a.client_id, clientName: a.clients?.name ?? null, type: a.type, title: a.title,
    date: a.date, hour: a.hour, duration_min: a.duration_min, status: a.status, provider_id: a.provider_id, providerName: a.staff?.name ?? null,
  }));

  // Unscheduled = open "Book …" tasks that map to a bookable discipline (the
  // "Book 12 strength sessions" task is a session, not an appointment, so it's
  // dropped here — sessions live on the Training Schedule).
  const nameById = new Map(clients.map((c) => [c.id, c.name]));
  const taskDiscipline = (title: string): string | null => {
    const t = title.toLowerCase();
    if (t.includes("doctor")) return "Doctor";
    if (t.includes("diet")) return "Dietitian";
    if (t.includes("psych")) return "Psychologist";
    if (t.includes("coach")) return "Health Coach";
    if (t.includes("fitness") || t.includes("reassess")) return "Fitness Trainer";
    return null;
  };
  const unscheduled: Unsched[] = ((tasksR.data ?? []) as { id: string; client_id: string | null; title: string; due_date: string | null }[])
    .map((t) => ({ t, disc: taskDiscipline(t.title) }))
    .filter((x): x is { t: { id: string; client_id: string | null; title: string; due_date: string | null }; disc: string } => Boolean(x.disc && x.t.client_id))
    .map(({ t, disc }) => {
      const cid = t.client_id as string;
      const ownerId = assignByClient.get(cid)?.[DISC_KEY[disc] ?? ""] ?? null;
      return {
        id: t.id,
        clientId: cid,
        clientName: nameById.get(cid) ?? "—",
        label: t.title.replace(/^Book\s+/i, "").replace(/\s+—\s+.*$/, ""),
        disc,
        due: t.due_date,
        owner: ownerId ? (staffName.get(ownerId) ?? null) : null,
        category: CATEGORY_OF[disc] ?? disc,
      };
    });

  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(weekEnd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;

  // Role-aware client status, keyed by client, for the appointment rows.
  const statusIds = Array.from(new Set(raw.map((a) => a.client_id).filter(Boolean))) as string[];
  const statusMap = await loadClientStatuses(supabase, statusIds, today);
  const statusDisc = disciplineForRole(me.role);
  const statusByClient: Record<string, ClientStatus> = {};
  for (const id of statusIds) statusByClient[id] = clientStatus(statusMap.get(id), statusDisc);

  // When front desk arrives here from a client's Service Timeline "Book" link,
  // give them a one-click way back to finish the rest of that client's bookings.
  const focusClientId = searchParams.client || null;
  const focusClientName = focusClientId ? (clients.find((c) => c.id === focusClientId)?.name ?? null) : null;

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["appointments"]} />

      {focusClientId && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--brand-tint)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 14 }}>
          <Link href={`/clients/${focusClientId}?tab=timeline`} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)", whiteSpace: "nowrap" }}>
            ← Back to Service Timeline
          </Link>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Booking for <b style={{ color: "var(--ink)" }}>{focusClientName ?? "this client"}</b> — schedule this appointment, then head back to book the rest of their journey.
          </span>
        </div>
      )}

      <AppointmentsView
        today={today} days={days} hours={HOURS} appts={appts} providers={providers} clients={clients} unscheduled={unscheduled}
        weekLabel={weekLabel} prevHref={`/appointments?week=${offset - 1}`} nextHref={`/appointments?week=${offset + 1}`} isThisWeek={offset === 0}
        statusByClient={statusByClient}
      />

      <div style={{ marginTop: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
        🏋 Training sessions (strength / PT slots) — which client trains with which trainer — are managed on the <Link href="/sessions" style={{ color: "var(--brand-text)", fontWeight: 600 }}>Training Schedule</Link> page.
      </div>
    </div>
  );
}
