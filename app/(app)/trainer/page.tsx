import WorkspaceTabs from "@/components/WorkspaceTabs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import SessionActions from "@/components/SessionActions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { RingMeter } from "@/components/Meters";
import StatCard from "@/components/StatCard";

import { todayISO, todayLabel } from "@/lib/today";

export const dynamic = "force-dynamic";

const TODAY = todayISO();

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

type Sess = {
  id: string; seq: number; date: string; hour: number; status: string; trainer_id: string;
  clients: { id: string; name: string; code: string | null } | null;
  staff: { name: string } | null;
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default async function TrainerPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/trainer")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: todayData }, { data: upData }, { data: trainerData }, doneToday] = await Promise.all([
    supabase.from("sessions").select("id, seq, date, hour, status, trainer_id, clients(id, name, code), staff(name)").eq("date", TODAY).order("hour"),
    supabase.from("sessions").select("id, seq, date, hour, status, trainer_id, clients(id, name, code), staff(name)").eq("status", "scheduled").gt("date", TODAY).order("date").order("hour").limit(40),
    supabase.from("staff").select("id, name").eq("is_trainer", true).order("name"),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("date", TODAY).eq("status", "completed"),
  ]);

  const today = (todayData ?? []) as unknown as Sess[];
  const upcoming = (upData ?? []) as unknown as Sess[];
  const trainers = (trainerData ?? []) as { id: string; name: string }[];
  const scheduledToday = today.filter((s) => s.status === "scheduled");

  const card = (s: Sess) => (
    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: "1px solid var(--border)" }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--brand-fill)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>
        {s.clients ? initials(s.clients.name) : "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {s.clients ? (
          <Link href={`/clients/${s.clients.id}`} style={{ color: "var(--ink)", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            {s.clients.name}
          </Link>
        ) : "—"}
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Session #{s.seq} · {fmtHour(s.hour)} · {s.staff?.name ?? "—"}
        </div>
      </div>
      {s.status === "completed" ? (
        <span style={{ background: "var(--green-bg)", color: "#166534", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>✓ Checked in</span>
      ) : (
        <SessionActions id={s.id} clientId={s.clients?.id ?? ""} date={s.date} hour={s.hour} trainerId={s.trainer_id} status={s.status} trainers={trainers} />
      )}
    </div>
  );

  const kpi = (label: string, value: number | string) => <StatCard label={label} value={value} />;

  return (
    <div style={{ maxWidth: 900 }}>
      <RealtimeRefresh tables={["sessions"]} />
      <WorkspaceTabs active="trainer" />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Trainer</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Session board · today {todayLabel()}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        {kpi("Today — to check in", scheduledToday.length)}
        {kpi("Checked in today", doneToday.count ?? 0)}
        {kpi("Upcoming (next)", upcoming.length)}
        {today.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, minWidth: 210 }}>
            <RingMeter value={Math.round(((doneToday.count ?? 0) / today.length) * 100)} size={68} stroke={9} label="Check-in rate" />
            <div style={{ fontSize: 12, color: "var(--muted)" }}><b style={{ color: "var(--ink)", fontSize: 15 }}>{doneToday.count ?? 0}/{today.length}</b><br />sessions checked in today</div>
          </div>
        )}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: 18 }}>
        <div style={{ padding: "12px 16px", fontWeight: 700 }}>Today&apos;s sessions</div>
        {today.length ? today.map(card) : <div style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>No sessions scheduled today.</div>}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", fontWeight: 700 }}>Upcoming</div>
        {upcoming.length ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              {upcoming.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px" }}>
                    {s.clients ? (
                      <Link href={`/clients/${s.clients.id}`} style={{ color: "var(--brand-text)", fontWeight: 600, textDecoration: "none" }}>{s.clients.name}</Link>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--muted)" }}>#{s.seq}</td>
                  <td style={{ padding: "10px 16px" }}>{s.date}</td>
                  <td style={{ padding: "10px 16px" }}>{fmtHour(s.hour)}</td>
                  <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{s.staff?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{ padding: "18px 16px", color: "var(--muted)", fontSize: 13, borderTop: "1px solid var(--border)" }}>Nothing upcoming.</div>}
      </div>
    </div>
  );
}
