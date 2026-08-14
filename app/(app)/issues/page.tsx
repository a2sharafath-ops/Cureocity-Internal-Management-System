import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canTriageIssues, ISSUE_STATUSES } from "@/lib/issue-reports";
import { assertCriticalQueries } from "@/lib/runtime-errors";
import { IST } from "@/lib/datetime";

export const dynamic = "force-dynamic";

type IssueRow = {
  id: string;
  report_type: string;
  severity: string;
  description: string;
  route: string;
  reporter_name: string;
  reporter_role: string;
  status: string;
  attachment_path: string | null;
  created_at: string;
  updated_at: string;
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: IST });
}

const severityTone: Record<string, React.CSSProperties> = {
  Critical: { background: "var(--red-bg)", color: "var(--red-text)" },
  High: { background: "var(--amber-bg)", color: "var(--amber-text)" },
  Medium: { background: "var(--blue-bg)", color: "var(--blue-text)" },
  Low: { background: "var(--neutral-bg)", color: "var(--muted)" },
};

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const me = await getProfile();
  if (!me || !canTriageIssues(me.role)) redirect("/dashboard");
  const requested = (await searchParams).status;
  const status = (ISSUE_STATUSES as readonly string[]).includes(requested ?? "") ? requested! : "Open";

  const supabase = await createClient();
  let query = supabase.from("issue_reports")
    .select("id, report_type, severity, description, route, reporter_name, reporter_role, status, attachment_path, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status !== "Open") query = query.eq("status", status);
  else query = query.in("status", ["Open", "In progress"]);
  const result = await query;
  assertCriticalQueries("issue_reports", [["issue_reports", result]]);
  const rows = (result.data ?? []) as IssueRow[];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "11px 14px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px" };

  return (
    <div style={{ maxWidth: 1140 }}>
      <h1 style={{ fontSize: 20, margin: "0 0 3px" }}>Issue reports</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Internal bug and feedback queue. Reports contain operational context, not clinical records.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {["Open", "In progress", "Resolved", "Dismissed"].map((value) => (
          <Link key={value} href={`/issues?status=${encodeURIComponent(value)}`} style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "6px 11px", background: status === value || (status === "Open" && value === "Open") ? "var(--ink)" : "#fff", color: status === value || (status === "Open" && value === "Open") ? "#fff" : "var(--muted)", textDecoration: "none", fontSize: 12, fontWeight: 650 }}>{value}</Link>
        ))}
      </div>

      <div style={{ ...box, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820, fontSize: 13 }}>
          <thead><tr><th style={th}>Reported</th><th style={th}>Type</th><th style={th}>Severity</th><th style={th}>Summary</th><th style={th}>Reporter</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "11px 14px", whiteSpace: "nowrap", color: "var(--muted)" }}>{when(row.created_at)}</td>
                <td style={{ padding: "11px 14px", fontWeight: 650 }}>{row.report_type}{row.attachment_path && <span title="Screenshot attached" style={{ marginLeft: 5 }}>▧</span>}</td>
                <td style={{ padding: "11px 14px" }}><span style={{ ...severityTone[row.severity], borderRadius: 999, padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>{row.severity}</span></td>
                <td style={{ padding: "11px 14px", maxWidth: 360 }}><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.description}</div><div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{row.route}</div></td>
                <td style={{ padding: "11px 14px" }}>{row.reporter_name}<div style={{ color: "var(--muted)", fontSize: 11 }}>{row.reporter_role}</div></td>
                <td style={{ padding: "11px 14px" }}>{row.status}</td>
                <td style={{ padding: "11px 14px", textAlign: "right" }}><Link href={`/issues/${row.id}`} style={{ color: "var(--brand-text)", fontWeight: 700, textDecoration: "none" }}>Open →</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>No reports in this queue.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
