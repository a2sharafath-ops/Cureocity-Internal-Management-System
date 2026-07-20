import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { maskName } from "@/lib/phi";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MetricCard from "@/components/MetricCard";
import PhiReveal from "@/components/PhiReveal";
import IdentityForm from "@/components/IdentityForm";
import { ConsentForm, BreachForm, RetentionForm, ConsentRevoke, BreachActions } from "@/components/GovernanceForms";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/compliance")) redirect("/dashboard");

  const supabase = createClient();
  const [consentsR, breachesR, retentionR, clientsR, accessR] = await Promise.all([
    supabase.from("consents").select("id, type, granted, method, granted_date, expires_date, revoked_date, clients(id, name)").order("created_at", { ascending: false }).limit(60),
    supabase.from("breach_incidents").select("id, title, severity, affected_count, discovered_date, status, reported_to_authority, reported_date").order("created_at", { ascending: false }),
    supabase.from("retention_policies").select("id, data_type, retain_years, legal_basis, action_after").order("data_type"),
    supabase.from("clients").select("id, name, abha_id, uhid").order("name"),
    supabase.from("audit_log").select("id, actor_name, actor_role, action, target, created_at").order("created_at", { ascending: false }).limit(30),
  ]);

  const consents = (consentsR.data ?? []) as unknown as { id: string; type: string; granted: boolean; method: string; granted_date: string | null; expires_date: string | null; revoked_date: string | null; clients: { id: string; name: string } | null }[];
  const breaches = (breachesR.data ?? []) as { id: string; title: string; severity: string; affected_count: number; discovered_date: string | null; status: string; reported_to_authority: boolean; reported_date: string | null }[];
  const retention = (retentionR.data ?? []) as { id: string; data_type: string; retain_years: number; legal_basis: string | null; action_after: string }[];
  const clients = (clientsR.data ?? []) as { id: string; name: string; abha_id: string | null; uhid: string | null }[];
  const identified = clients.filter((c) => c.abha_id || c.uhid);
  const access = (accessR.data ?? []) as { id: string; actor_name: string | null; actor_role: string | null; action: string; target: string | null; created_at: string }[];

  const openBreaches = breaches.filter((b) => b.status !== "closed").length;
  const activeConsents = consents.filter((c) => c.granted).length;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const stat = (label: string, value: string, color = "var(--brand-text)") => <MetricCard label={label} value={value} color={color} />;
  const sevColor = (s: string) => s === "critical" ? "var(--red)" : s === "high" ? "var(--amber-text-soft)" : s === "low" ? "var(--muted)" : "var(--amber-text)";

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["consents", "breach_incidents"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Compliance &amp; governance</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Consent, incident register, data-retention policy and a PHI-masked access trail. Interop: export any chart as FHIR from the EMR.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        {stat("Active consents", String(activeConsents))}
        {stat("Open incidents", String(openBreaches), openBreaches ? "var(--red)" : "var(--brand-text)")}
        {stat("Retention policies", String(retention.length))}
        {stat("PHI masking", "On", "var(--brand-text)")}
      </div>

      {/* identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Health identity (ABHA / UHID)</h2><span style={{ flex: 1 }} /><IdentityForm clients={clients} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 8px" }}>{identified.length} of {clients.length} patients linked to a national health ID.</p>
      <div style={{ ...box, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Patient</th><th style={th}>ABHA ID</th><th style={th}>UHID</th></tr></thead>
          <tbody>
            {identified.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}><Link href={`/clients/${c.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{c.name}</Link></td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{c.abha_id ?? "—"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{c.uhid ?? "—"}</td>
              </tr>
            ))}
            {identified.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "20px 16px" }}>No patients linked yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* consents */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Consent register</h2><span style={{ flex: 1 }} /><ConsentForm clients={clients} />
      </div>
      <div style={{ ...box, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Patient</th><th style={th}>Type</th><th style={th}>Method</th><th style={th}>Granted</th><th style={th}>Expires</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {consents.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>{c.clients ? <Link href={`/clients/${c.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{c.clients.name}</Link> : "—"}</td>
                <td style={{ ...td, textTransform: "capitalize" }}>{c.type.replace("-", " ")}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{c.method}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{c.granted_date ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{c.expires_date ?? "—"}</td>
                <td style={td}>{c.granted
                  ? <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>granted</span>
                  : <span style={{ background: "var(--red-bg)", color: "var(--red)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>revoked{c.revoked_date ? ` ${c.revoked_date}` : ""}</span>}</td>
                <td style={{ ...td, textAlign: "right" }}>{c.granted && <ConsentRevoke id={c.id} />}</td>
              </tr>
            ))}
            {consents.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No consent records.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* breach register */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Breach / incident register</h2><span style={{ flex: 1 }} /><BreachForm />
      </div>
      <div style={{ ...box, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Incident</th><th style={th}>Severity</th><th style={th}>Affected</th><th style={th}>Discovered</th><th style={th}>Status</th><th style={th}>Authority</th><th style={th} /></tr></thead>
          <tbody>
            {breaches.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{b.title}</td>
                <td style={{ ...td, color: sevColor(b.severity), fontWeight: 600, textTransform: "uppercase", fontSize: 12 }}>{b.severity}</td>
                <td style={td}>{b.affected_count}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{b.discovered_date ?? "—"}</td>
                <td style={{ ...td, textTransform: "capitalize" }}>{b.status}</td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{b.reported_to_authority ? `✓ ${b.reported_date ?? ""}` : "—"}</td>
                <td style={{ ...td, textAlign: "right" }}><BreachActions id={b.id} status={b.status} reported={b.reported_to_authority} /></td>
              </tr>
            ))}
            {breaches.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No incidents logged. 🎉</td></tr>}
          </tbody>
        </table>
      </div>

      {/* retention */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Data-retention policy</h2><span style={{ flex: 1 }} /><RetentionForm />
      </div>
      <div style={{ ...box, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Data type</th><th style={th}>Retain</th><th style={th}>Legal basis</th><th style={th}>Then</th></tr></thead>
          <tbody>
            {retention.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{r.data_type}</td>
                <td style={td}>{r.retain_years} yrs</td>
                <td style={{ ...td, color: "var(--muted)" }}>{r.legal_basis ?? "—"}</td>
                <td style={{ ...td, textTransform: "capitalize" }}>{r.action_after}</td>
              </tr>
            ))}
            {retention.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No policies.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* PHI-masked access log */}
      <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>Recent access — PHI masked</h2>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 8px" }}>Patient identifiers are masked by default. Click 👁 to reveal (authorized viewers only).</p>
      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>When</th><th style={th}>Actor</th><th style={th}>Action</th><th style={th}>Subject (PHI)</th></tr></thead>
          <tbody>
            {access.map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{new Date(a.created_at).toLocaleString()}</td>
                <td style={td}>{a.actor_name ?? "—"} <span style={{ color: "var(--muted)", fontSize: 12 }}>{a.actor_role ?? ""}</span></td>
                <td style={td}>{a.action}</td>
                <td style={td}>{a.target ? <PhiReveal raw={a.target} masked={maskName(a.target)} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
              </tr>
            ))}
            {access.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No recent activity.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
