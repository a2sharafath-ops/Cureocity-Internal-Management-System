import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TODAY = "2026-07-02";

function fmtHour(h: number | null) {
  if (h == null) return "—";
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${am ? "AM" : "PM"}`;
}

type Sess = {
  id: string;
  seq: number;
  date: string;
  hour: number;
  status: string;
  rescheduled: boolean;
  clients: { id: string; name: string; code: string | null } | null;
  staff: { name: string } | null;
};

export default async function SessionsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, seq, date, hour, status, rescheduled, clients(id, name, code), staff(name)")
    .eq("status", "scheduled")
    .gte("date", TODAY)
    .order("date", { ascending: true })
    .order("hour", { ascending: true })
    .limit(60);

  const sess = (data ?? []) as unknown as Sess[];
  const todayCount = sess.filter((s) => s.date === TODAY).length;

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Upcoming Sessions</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Strength sessions · {todayCount} today · {sess.length} upcoming (from Jul 2)
      </p>

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load sessions.</b> {error.message}
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "12px 16px" }}>Client</th>
                <th style={{ padding: "12px 16px" }}>Session</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Time</th>
                <th style={{ padding: "12px 16px" }}>Trainer</th>
              </tr>
            </thead>
            <tbody>
              {sess.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    {s.clients ? (
                      <Link href={`/clients/${s.clients.id}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 600 }}>
                        {s.clients.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{s.clients?.code ?? ""}</div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>#{s.seq}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {s.date === TODAY ? <b>Today</b> : s.date}
                    {s.rescheduled && (
                      <span style={{ marginLeft: 6, background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>
                        rescheduled
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{fmtHour(s.hour)}</td>
                  <td style={{ padding: "12px 16px" }}>{s.staff?.name ?? "—"}</td>
                </tr>
              ))}
              {sess.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                    No upcoming sessions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
