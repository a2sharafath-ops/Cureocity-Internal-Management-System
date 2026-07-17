import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { emailStatus } from "@/lib/email/config";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import TestEmailForm from "@/components/TestEmailForm";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/notifications")) redirect("/dashboard");

  const email = emailStatus();
  const supabase = createClient();
  const { data } = await supabase.from("email_log").select("id, to_email, template, subject, status, error, created_at").order("created_at", { ascending: false }).limit(50);
  const logs = (data ?? []) as { id: string; to_email: string; template: string | null; subject: string | null; status: string; error: string | null; created_at: string }[];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const chip = (s: string): [string, string] => {
    const m: Record<string, [string, string]> = { sent: ["var(--green-bg)", "#166534"], failed: ["#fee2e2", "var(--red)"], skipped: ["#eef2f1", "var(--muted)"], queued: ["var(--amber-bg)", "#92400e"] };
    return m[s] ?? ["#eef2f1", "var(--muted)"];
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["email_log"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Email notifications</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Transactional email for invoices, receipts, reminders and reports. Every attempt is logged below.</p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: email.configured ? "var(--green-bg)" : "#eef2f1", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 18, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Provider ({email.provider}):</span>
        {email.configured
          ? <span style={{ color: "#166534" }}>● Live — sending from <code>{email.from}</code>.</span>
          : <span style={{ color: "var(--muted)" }}>○ Not configured. Add <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> to your environment to start sending. Until then, sends are logged as <b>skipped</b> (dry-run).</span>}
      </div>

      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Send a test</h2>
      <TestEmailForm configured={email.configured} />

      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Email log</h2>
      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>When</th><th style={th}>To</th><th style={th}>Template</th><th style={th}>Subject</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {logs.map((l) => {
              const [bg, color] = chip(l.status);
              return (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={td}>{l.to_email}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{l.template ?? "—"}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{l.subject ?? "—"}</td>
                  <td style={td}><span style={{ background: bg, color, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }} title={l.error ?? ""}>{l.status}</span></td>
                </tr>
              );
            })}
            {logs.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No emails yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
