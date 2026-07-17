import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import AppointmentForm from "@/components/AppointmentForm";
import AppointmentActions from "@/components/AppointmentActions";

export const dynamic = "force-dynamic";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am..9pm
function hourLabel(h: number) { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr} ${am ? "AM" : "PM"}`; }
function addDays(iso: string, days: number) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function mondayOf(iso: string) { const d = new Date(iso + "T00:00:00"); const dow = (d.getDay() + 6) % 7; return addDays(iso, -dow); }
function dayName(iso: string) { return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short" }); }
function dayNum(iso: string) { return new Date(iso + "T00:00:00").getDate(); }

type Appt = { id: string; client_id: string; type: string | null; title: string | null; date: string; hour: number; duration_min: number; status: string; provider_id: string | null; clients: { id: string; name: string } | null; staff: { name: string } | null };

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
    supabase.from("staff").select("id, name").order("name"),
  ]);
  const appts = (apptsR.data ?? []) as unknown as Appt[];
  const clients = (clientsR.data ?? []) as { id: string; name: string }[];
  const staff = (staffR.data ?? []) as { id: string; name: string }[];

  // bucket by date|hour
  const cells = new Map<string, Appt[]>();
  for (const a of appts) {
    if (a.status === "cancelled") continue;
    const key = `${a.date}|${a.hour}`;
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(a);
  }

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const typeColor: Record<string, string> = { Consultation: "#0f766e", Assessment: "#7c3aed", "Follow-up": "#2563eb", Telehealth: "#0891b2", Procedure: "#b45309" };
  const statusStyle = (s: string): React.CSSProperties => s === "completed" ? { opacity: 0.6 } : s === "no_show" ? { opacity: 0.6, textDecoration: "line-through" } : {};

  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${new Date(weekEnd + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
  const navBtn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, textDecoration: "none", color: "var(--teal-dark)", fontWeight: 600 };

  return (
    <div style={{ maxWidth: 1180 }}>
      <RealtimeRefresh tables={["appointments"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Appointments</h1>
        <span style={{ flex: 1 }} />
        <AppointmentForm clients={clients} staff={staff} defaultDate={offset === 0 ? today : weekStart} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 14px" }}>
        <Link href={`/appointments?week=${offset - 1}`} style={navBtn}>← Prev</Link>
        <Link href="/appointments" style={{ ...navBtn, background: offset === 0 ? "var(--teal)" : "#fff", color: offset === 0 ? "#fff" : "var(--teal-dark)" }}>This week</Link>
        <Link href={`/appointments?week=${offset + 1}`} style={navBtn}>Next →</Link>
        <span style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>{weekLabel}</span>
      </div>

      <div style={{ ...box, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ width: 56, padding: "8px 6px", borderBottom: "1px solid var(--border)" }} />
              {days.map((d) => (
                <th key={d} style={{ padding: "8px 6px", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", textAlign: "center", background: d === today ? "#e0f2f1" : "transparent" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{dayName(d)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: d === today ? "var(--teal-dark)" : "inherit" }}>{dayNum(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h}>
                <td style={{ padding: "4px 6px", color: "var(--muted)", fontSize: 11, textAlign: "right", verticalAlign: "top", borderTop: "1px solid var(--border)" }}>{hourLabel(h)}</td>
                {days.map((d) => {
                  const list = cells.get(`${d}|${h}`) ?? [];
                  return (
                    <td key={d} style={{ borderTop: "1px solid var(--border)", borderLeft: "1px solid var(--border)", padding: 3, verticalAlign: "top", height: 42, background: d === today ? "rgba(224,242,241,0.35)" : "transparent" }}>
                      {list.map((a) => {
                        const col = typeColor[a.type ?? ""] ?? "#0f766e";
                        return (
                          <div key={a.id} style={{ ...statusStyle(a.status), background: col + "1a", borderLeft: `3px solid ${col}`, borderRadius: 6, padding: "3px 6px", marginBottom: 3 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                              {a.clients ? <Link href={`/clients/${a.clients.id}`} style={{ color: "inherit", textDecoration: "none" }}>{a.clients.name}</Link> : "—"}
                            </div>
                            <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{a.title ?? a.type}{a.staff?.name ? ` · ${a.staff.name}` : ""}</div>
                            <AppointmentActions id={a.id} status={a.status} />
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
        {Object.entries(typeColor).map(([k, c]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: "inline-block" }} />{k}</span>
        ))}
      </div>
    </div>
  );
}
