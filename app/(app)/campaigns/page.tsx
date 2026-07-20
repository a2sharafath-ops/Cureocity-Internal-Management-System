import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { emailStatus } from "@/lib/email/config";
import { archiveTemplate } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { TemplateForm, CampaignForm, SendCampaign } from "@/components/CampaignForms";

export const dynamic = "force-dynamic";

const AUDIENCE_LABEL: Record<string, string> = { all: "All clients", members: "Members", subscribers: "Active subscribers", lapsed: "Lapsed (30d)" };

export default async function CampaignsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/campaigns")) redirect("/dashboard");

  const email = emailStatus();
  const supabase = createClient();
  const [templatesR, campaignsR] = await Promise.all([
    supabase.from("message_templates").select("id, name, category, subject, active").eq("active", true).order("created_at", { ascending: false }),
    supabase.from("campaigns").select("id, name, audience, status, sent_count, sent_at, message_templates(name)").order("created_at", { ascending: false }).limit(50),
  ]);
  const templates = (templatesR.data ?? []) as { id: string; name: string; category: string; subject: string; active: boolean }[];
  const campaigns = (campaignsR.data ?? []) as unknown as { id: string; name: string; audience: string; status: string; sent_count: number; sent_at: string | null; message_templates: { name: string } | null }[];

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };

  return (
    <div style={{ maxWidth: 1040 }}>
      <RealtimeRefresh tables={["campaigns", "email_log"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Campaigns</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>Reusable templates and one-click audience sends. Delivery uses your email provider — every send is logged in Notifications.</p>

      {!email.configured && (
        <div style={{ background: "var(--neutral-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "var(--muted)" }}>
          Email provider not configured — sends run as <b>dry-runs</b> (recipients resolved and logged, nothing delivered) until <code>RESEND_API_KEY</code> is set.
        </div>
      )}

      {/* campaigns */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Campaigns</h2><span style={{ flex: 1 }} />
        <CampaignForm templates={templates} />
      </div>
      <div style={{ ...box, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Template</th><th style={th}>Audience</th><th style={th}>Status</th><th style={th}>Sent</th><th style={th} /></tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{c.message_templates?.name ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{AUDIENCE_LABEL[c.audience] ?? c.audience}</td>
                <td style={td}><span style={{ background: c.status === "sent" ? "var(--green-bg)" : "var(--neutral-bg)", color: c.status === "sent" ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{c.status}</span></td>
                <td style={td}>{c.status === "sent" ? `${c.sent_count}${c.sent_at ? ` · ${c.sent_at.slice(0, 10)}` : ""}` : "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{c.status !== "sent" && <SendCampaign id={c.id} configured={email.configured} />}</td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* templates */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Templates</h2><span style={{ flex: 1 }} />
        <TemplateForm />
      </div>
      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Category</th><th style={th}>Subject</th><th style={th} /></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{t.name}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{t.category}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{t.subject}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <form action={archiveTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--muted)" }}>Archive</button>
                  </form>
                </td>
              </tr>
            ))}
            {templates.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No templates yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
