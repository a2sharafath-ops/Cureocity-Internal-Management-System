import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

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
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function actionColor(a: string): string {
  if (a.includes("created")) return "var(--green-bg)";
  if (a.includes("Role")) return "var(--purple-bg)";
  if (a.includes("rescheduled")) return "var(--amber-bg)";
  if (a.includes("completed")) return "var(--teal-light)";
  return "#eef2f1";
}

export default async function AuditPage() {
  const me = await getProfile();
  if (!me || me.role !== "Administrator") redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, actor_name, actor_role, action, target, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Row[];

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Audit Log</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>
        Who did what · newest first · last {rows.length} event{rows.length === 1 ? "" : "s"} · Administrator only
      </p>

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load the audit log.</b> {error.message}
          <div style={{ marginTop: 6, fontSize: 12 }}>Make sure supabase/0004_audit_log.sql has been run.</div>
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "12px 16px" }}>When</th>
                <th style={{ padding: "12px 16px" }}>Who</th>
                <th style={{ padding: "12px 16px" }}>Action</th>
                <th style={{ padding: "12px 16px" }}>Target</th>
                <th style={{ padding: "12px 16px" }}>Detail</th>
              </tr>
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
                    <span style={{ background: actionColor(r.action), borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                      {r.action}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{r.target ?? "—"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{r.detail ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>
                    No activity logged yet — make a change (add a client, move a lead, reschedule a session) and it&apos;ll appear here.
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
