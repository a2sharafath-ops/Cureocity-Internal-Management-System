import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import ExportAuditButton, { type AuditExportRow } from "@/components/ExportAuditButton";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: string;
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AuditPage() {
  const me = await getProfile();
  if (!me || (me.role !== "Administrator" && me.role !== "Super Admin")) redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, actor_name, actor_role, action, target, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as Row[];
  const detailOf = (r: Row) => [r.target, r.detail].filter(Boolean).join(" · ") || "—";
  const exportRows: AuditExportRow[] = rows.map((r) => ({ when: when(r.created_at), user: r.actor_name ?? "—", role: r.actor_role ?? "", action: r.action, detail: detailOf(r) }));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" };

  return (
    <div style={{ maxWidth: 1120 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 2px" }}>Audit Log</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Every change — who did what, and when</p>
        </div>
        <span style={{ flex: 1 }} />
        <ExportAuditButton rows={exportRows} />
      </div>

      {error ? (
        <div style={{ marginTop: 16, background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load the audit log.</b> {error.message}
          <div style={{ marginTop: 6, fontSize: 12 }}>Make sure supabase/0004_audit_log.sql has been run.</div>
        </div>
      ) : (
        <>
          {/* Audit trail intro */}
          <div style={{ ...box, padding: "16px 20px", margin: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <b style={{ fontSize: 15 }}>Audit trail</b>
              <span style={{ flex: 1 }} />
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{rows.length} event{rows.length === 1 ? "" : "s"} · newest first · immutable log</span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>Every side-effectful action (payments, refunds, messages, role changes, sign-ins) is recorded with the acting user and time.</p>
          </div>

          <div style={{ ...box, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 720 }}>
              <thead>
                <tr><th style={th}>When</th><th style={th}>User</th><th style={th}>Action</th><th style={th}>Detail</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--muted)", whiteSpace: "nowrap" }}>{when(r.created_at)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <b>{r.actor_name ?? "—"}</b>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.actor_role ?? ""}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>{r.action}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{detailOf(r)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                      No activity logged yet — make a change (add a client, move a lead, reschedule a session) and it&apos;ll appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
