import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canTriageIssues } from "@/lib/issue-reports";
import { assertCriticalQueries, logServerError } from "@/lib/runtime-errors";
import { IST } from "@/lib/datetime";
import IssueTriageForm from "@/components/IssueTriageForm";

export const dynamic = "force-dynamic";

type IssueDetail = {
  id: string;
  report_type: string;
  severity: string;
  description: string;
  route: string;
  client_ref: string | null;
  browser_context: Record<string, string | number> | null;
  reporter_name: string;
  reporter_role: string;
  attachment_bucket: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  status: string;
  admin_note: string | null;
  triaged_by_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: IST });
}

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getProfile();
  if (!me || !canTriageIssues(me.role)) redirect("/dashboard");
  const { id } = await params;
  const supabase = await createClient();
  const result = await supabase.from("issue_reports")
    .select("id, report_type, severity, description, route, client_ref, browser_context, reporter_name, reporter_role, attachment_bucket, attachment_path, attachment_name, attachment_size, status, admin_note, triaged_by_name, created_at, updated_at, resolved_at")
    .eq("id", id).maybeSingle();
  assertCriticalQueries("issue_report_detail", [["issue_report", result]]);
  if (!result.data) notFound();
  const issue = result.data as IssueDetail;

  let attachmentUrl: string | null = null;
  if (issue.attachment_bucket && issue.attachment_path) {
    const signed = await supabase.storage.from(issue.attachment_bucket).createSignedUrl(issue.attachment_path, 900);
    if (signed.error) logServerError(signed.error, { source: "signed_url", scope: "issue_attachment" });
    attachmentUrl = signed.data?.signedUrl ?? null;
  }

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 18 };
  const context = issue.browser_context ?? {};

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 12 }}><Link href="/issues" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 13 }}>← Issue reports</Link></div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div><h1 style={{ fontSize: 20, margin: "0 0 3px" }}>{issue.report_type} · {issue.severity}</h1><div style={{ color: "var(--muted)", fontSize: 12 }}>Reported {when(issue.created_at)} by {issue.reporter_name} ({issue.reporter_role})</div></div>
        <span style={{ flex: 1 }} />
        <span style={{ borderRadius: 999, background: "var(--neutral-bg)", padding: "5px 10px", fontSize: 12, fontWeight: 700 }}>{issue.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(260px, .8fr)", gap: 16 }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section style={box}>
            <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>What happened</h2>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 14 }}>{issue.description}</div>
          </section>
          <section style={box}>
            <h2 style={{ fontSize: 14, margin: "0 0 10px" }}>Operational context</h2>
            <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "8px 12px", margin: 0, fontSize: 12.5 }}>
              <dt style={{ color: "var(--muted)" }}>Route</dt><dd style={{ margin: 0 }}><Link href={issue.route} style={{ color: "var(--brand-text)" }}>{issue.route}</Link></dd>
              <dt style={{ color: "var(--muted)" }}>Client reference</dt><dd style={{ margin: 0 }}>{issue.client_ref ? <Link href={`/clients/${issue.client_ref}`} style={{ color: "var(--brand-text)" }}>{issue.client_ref}</Link> : "Not captured"}</dd>
              <dt style={{ color: "var(--muted)" }}>Browser</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{String(context.browser ?? "Not captured")}</dd>
              <dt style={{ color: "var(--muted)" }}>Platform</dt><dd style={{ margin: 0 }}>{String(context.platform ?? "Not captured")}</dd>
              <dt style={{ color: "var(--muted)" }}>Viewport</dt><dd style={{ margin: 0 }}>{String(context.viewport ?? "Not captured")}</dd>
              <dt style={{ color: "var(--muted)" }}>Last updated</dt><dd style={{ margin: 0 }}>{when(issue.updated_at)}</dd>
            </dl>
          </section>
          {issue.attachment_path && <section style={box}>
            <h2 style={{ fontSize: 14, margin: "0 0 8px" }}>Screenshot</h2>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 9 }}>{issue.attachment_name ?? "Screenshot"}{issue.attachment_size ? ` · ${Math.ceil(issue.attachment_size / 1024)} KB` : ""}</div>
            {attachmentUrl ? <a href={attachmentUrl} target="_blank" rel="noreferrer" style={{ color: "var(--brand-text)", fontWeight: 700, fontSize: 13 }}>Open private screenshot ↗</a> : <div style={{ color: "var(--red-text)", fontSize: 12 }}>Screenshot is temporarily unavailable.</div>}
          </section>}
        </div>
        <aside style={box}>
          <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Administrator triage</h2>
          <IssueTriageForm id={issue.id} status={issue.status} note={issue.admin_note} />
          {issue.triaged_by_name && <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 11.5 }}>Last triaged by {issue.triaged_by_name}{issue.resolved_at ? ` · resolved ${when(issue.resolved_at)}` : ""}</div>}
        </aside>
      </div>
    </div>
  );
}
