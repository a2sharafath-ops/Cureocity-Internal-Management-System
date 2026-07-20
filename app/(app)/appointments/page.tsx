import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import AppointmentsView, { type ViewAppt, type Provider } from "@/components/AppointmentsView";

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

export default async function AppointmentsPage({ searchParams }: { searchParams: { week?: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/appointments")) redirect("/dashboard");

  const offset = Number(searchParams.week) || 0;
  const today = todayISO();
  const weekStart = addDays(mondayOf(today), offset * 7);
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const supabase = createClient();
  const [apptsR, clientsR, staffR] = await Promise.all([
    supabase.from("appointments").select("id, client_id, type, title, date, hour, duration_min, status, provider_id, clients(id, name), staff(name)").gte("date", weekStart).lte("date", weekEnd).order("hour"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("staff").select("id, name, designation, department, color, is_trainer").order("name"),
  ]);
  const raw = (apptsR.data ?? []) as unknown as Appt[];
  const clients = (clientsR.data ?? []) as { id: string; name: string }[];
  const staffRows = (staffR.data ?? []) as StaffRow[];

  // Providers = care-team members that map to a booking discipline.
  const providers: Provider[] = staffRows
    .map((s) => ({ id: s.id, name: s.name, color: s.color ?? "#0f766e", discipline: disciplineOf(s) }))
    .filter((p) => p.discipline !== "Other");

  const appts: ViewAppt[] = raw.map((a) => ({
    id: a.id, client_id: a.client_id, clientName: a.clients?.name ?? null, type: a.type, title: a.title,
    date: a.date, hour: a.hour, duration_min: a.duration_min, status: a.status, provider_id: a.provider_id, providerName: a.staff?.name ?? null,
  }));

  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(weekEnd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["appointments"]} />

      <AppointmentsView
        today={today} days={days} hours={HOURS} appts={appts} providers={providers} clients={clients}
        weekLabel={weekLabel} prevHref={`/appointments?week=${offset - 1}`} nextHref={`/appointments?week=${offset + 1}`} isThisWeek={offset === 0}
      />

      <div style={{ marginTop: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
        🏋 Training sessions (strength / PT slots) — which client trains with which trainer — are managed on the <Link href="/sessions" style={{ color: "var(--brand-text)", fontWeight: 600 }}>Training Schedule</Link> page.
      </div>
    </div>
  );
}
