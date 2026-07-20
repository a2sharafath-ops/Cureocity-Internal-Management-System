import Link from "next/link";
import BackLink from "@/components/BackLink";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { telehealthStatus } from "@/lib/telehealth/config";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import TelehealthForm from "@/components/TelehealthForm";
import TelehealthActions from "@/components/TelehealthActions";

export const dynamic = "force-dynamic";

type Sess = { id: string; provider: string; room_url: string | null; status: string; scheduled_for: string | null; created_at: string; clients: { id: string; name: string } | null };

export default async function TelehealthPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/telehealth")) redirect("/dashboard");

  const th = telehealthStatus();
  const supabase = createClient();
  const [{ data: sessData }, { data: clientData }] = await Promise.all([
    supabase.from("telehealth_sessions").select("id, provider, room_url, status, scheduled_for, created_at, clients(id, name)").order("created_at", { ascending: false }).limit(80),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const sessions = (sessData ?? []) as unknown as Sess[];
  const clients = (clientData ?? []) as { id: string; name: string }[];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th2: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const chip = (s: string) => {
    const m: Record<string, [string, string]> = { scheduled: ["#dbeafe", "#2563eb"], active: ["var(--green-bg)", "#166534"], ended: ["#eef2f1", "var(--muted)"] };
    const [bg, c] = m[s] ?? ["#eef2f1", "var(--muted)"];
    return <span style={{ background: bg, color: c, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{s}</span>;
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["telehealth_sessions"]} />
      <BackLink />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Telehealth</h1>
        <span style={{ flex: 1 }} />
        <TelehealthForm clients={clients} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 14px" }}>Video consultations — create a room, share the link, and start.</p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: th.secure ? "var(--green-bg)" : "#eef2f1", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Provider:</span>
        {th.secure
          ? <span style={{ color: "#166534" }}>● {th.provider} — private, provider-hosted rooms.</span>
          : <span style={{ color: "var(--muted)" }}>○ Using public Jitsi rooms (work immediately, no key). For private/recorded sessions set <code>TELEHEALTH_PROVIDER</code> + <code>TELEHEALTH_API_KEY</code>.</span>}
      </div>

      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th2}>Patient</th><th style={th2}>Scheduled</th><th style={th2}>Room</th><th style={th2}>Status</th><th style={th2} /></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>{s.clients ? <Link href={`/clients/${s.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{s.clients.name}</Link> : "Ad-hoc"}</td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{s.scheduled_for ? new Date(s.scheduled_for).toLocaleString() : "—"}</td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.room_url ?? "—"}</td>
                <td style={td}>{chip(s.status)}</td>
                <td style={{ ...td, textAlign: "right" }}><TelehealthActions id={s.id} status={s.status} roomUrl={s.room_url} /></td>
              </tr>
            ))}
            {sessions.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No telehealth sessions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
