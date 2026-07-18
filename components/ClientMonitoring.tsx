// Client Monitoring — role-scoped engagement/tracking table (server component).
import Link from "next/link";

export type MonitorRow = {
  id: string;
  name: string;
  code: string | null;
  pkg: string | null;
  sessionsUsed: number;
  sessionsTotal: number;
  openFollowups: number;
  openConcerns: number;
  conditions: string | null;
  goals: string[];
  lastMdt: string | null;
};

export default function ClientMonitoring({ role, rows, linkQuery = "" }: { role: "doctor" | "diet" | "trainer" | "coach" | "psych"; rows: MonitorRow[]; linkQuery?: string }) {
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" };
  const td: React.CSSProperties = { padding: "11px 14px", fontSize: 13, verticalAlign: "middle" };
  const chip = (bg: string, c: string, t: string) => <span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>{t}</span>;

  // role-specific "focus" column
  const focusHead = role === "doctor" ? "Conditions" : role === "trainer" ? "Attendance" : "Goals";
  const focusCell = (r: MonitorRow) => {
    if (role === "doctor") {
      const has = r.conditions && r.conditions.trim().toLowerCase() !== "none";
      return has ? chip("var(--amber-bg)", "#92400e", r.conditions!.length > 26 ? r.conditions!.slice(0, 26) + "…" : r.conditions!) : <span style={{ color: "var(--muted)" }}>—</span>;
    }
    if (role === "trainer") {
      if (!r.sessionsTotal) return <span style={{ color: "var(--muted)" }}>—</span>;
      const pct = Math.min(100, Math.round((r.sessionsUsed / r.sessionsTotal) * 100));
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "#eef2f1", borderRadius: 6, height: 8, width: 80, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: pct >= 80 ? "#16a34a" : "var(--teal)" }} /></div>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.sessionsUsed}/{r.sessionsTotal}</span>
        </div>
      );
    }
    return r.goals.length ? <span style={{ fontSize: 12 }}>{r.goals.slice(0, 2).join(", ")}</span> : <span style={{ color: "var(--muted)" }}>—</span>;
  };

  if (rows.length === 0) {
    return <div style={{ ...box, padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No clients to monitor in this workspace yet.</div>;
  }

  const atRisk = rows.filter((r) => r.openConcerns > 0 || r.openFollowups > 0).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {chip("#eef2f1", "var(--muted)", `${rows.length} clients`)}
        {chip(atRisk ? "var(--amber-bg)" : "var(--green-bg)", atRisk ? "#92400e" : "#166534", `${atRisk} need attention`)}
      </div>
      <div style={{ ...box, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Client</th>
              <th style={th}>Package</th>
              <th style={th}>{focusHead}</th>
              <th style={th}>Follow-ups</th>
              <th style={th}>Concerns</th>
              <th style={th}>Latest MDT note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>
                  <Link href={`/clients/${r.id}${linkQuery}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 700 }}>{r.name}</Link>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.code ?? "—"}</div>
                </td>
                <td style={td}>{r.pkg ? chip("var(--teal-light)", "var(--teal-dark)", r.pkg) : "—"}</td>
                <td style={td}>{focusCell(r)}</td>
                <td style={td}>{r.openFollowups ? chip("var(--amber-bg)", "#92400e", `${r.openFollowups} open`) : chip("var(--green-bg)", "#166534", "Clear")}</td>
                <td style={td}>{r.openConcerns ? chip("var(--red-bg)", "#991b1b", `${r.openConcerns} open`) : chip("#eef2f1", "var(--muted)", "None")}</td>
                <td style={{ ...td, color: "var(--muted)", maxWidth: 220 }}>{r.lastMdt ? (r.lastMdt.length > 60 ? r.lastMdt.slice(0, 60) + "…" : r.lastMdt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
