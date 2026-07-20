import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StatCard from "@/components/StatCard";
import { InsurerForm, PolicyForm, ClaimForm } from "@/components/ClaimsForms";
import ClaimActions from "@/components/ClaimActions";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default async function ClaimsPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/claims")) redirect("/dashboard");

  const supabase = createClient();
  const [claimsR, insurersR, policiesR, clientsR] = await Promise.all([
    supabase.from("claims").select("id, claim_number, service_desc, amount_claimed, amount_approved, status, submitted_date, decision_date, clients(id, name), insurers(name)").order("created_at", { ascending: false }).limit(100),
    supabase.from("insurers").select("id, name, kind, contact, active").order("name"),
    supabase.from("insurance_policies").select("id, policy_number, plan_name, coverage_amount, valid_to, status, clients(id, name), insurers(name)").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const claims = (claimsR.data ?? []) as unknown as { id: string; claim_number: string | null; service_desc: string | null; amount_claimed: number; amount_approved: number | null; status: string; submitted_date: string | null; decision_date: string | null; clients: { id: string; name: string } | null; insurers: { name: string } | null }[];
  const insurers = (insurersR.data ?? []) as { id: string; name: string; kind: string; contact: string | null; active: boolean }[];
  const policies = (policiesR.data ?? []) as unknown as { id: string; policy_number: string | null; plan_name: string | null; coverage_amount: number; valid_to: string | null; status: string; clients: { id: string; name: string } | null; insurers: { name: string } | null }[];
  const clients = (clientsR.data ?? []) as { id: string; name: string }[];

  // policies grouped by client for the claim form
  const policiesByClient: Record<string, { id: string; label: string }[]> = {};
  const rawPolicies = (policiesR.data ?? []) as unknown as { id: string; policy_number: string | null; coverage_amount: number; clients: { id: string } | null; insurers: { name: string } | null }[];
  for (const pol of rawPolicies) {
    const cid = pol.clients?.id;
    if (!cid) continue;
    (policiesByClient[cid] ??= []).push({ id: pol.id, label: `${pol.insurers?.name ?? "Policy"}${pol.policy_number ? ` · ${pol.policy_number}` : ""}` });
  }

  const pending = claims.filter((c) => ["submitted", "in_review"].includes(c.status));
  const totalClaimed = claims.reduce((s, c) => s + Number(c.amount_claimed), 0);
  const totalApproved = claims.reduce((s, c) => s + Number(c.amount_approved ?? 0), 0);
  const paid = claims.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount_approved ?? c.amount_claimed), 0);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px", fontSize: 14 };
  const stat = (label: string, value: string, color = "var(--brand-text)") => <StatCard label={label} value={value} color={color} />;
  const chipFor = (s: string): [string, string] => {
    const m: Record<string, [string, string]> = {
      draft: ["#eef2f1", "var(--muted)"], submitted: ["#e0f2f1", "var(--brand-text)"], in_review: ["var(--amber-bg)", "#92400e"],
      approved: ["var(--green-bg)", "#166534"], rejected: ["#fee2e2", "var(--red)"], paid: ["#dcfce7", "#166534"],
    };
    return m[s] ?? ["#eef2f1", "var(--muted)"];
  };

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["claims", "insurance_policies"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Insurance &amp; claims</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Payers, patient policies and the claims pipeline from draft through settlement.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        {stat("Pending claims", String(pending.length), pending.length ? "#92400e" : "var(--brand-text)")}
        {stat("Total claimed", money(totalClaimed))}
        {stat("Approved", money(totalApproved))}
        {stat("Settled / paid", money(paid))}
      </div>

      {/* claims */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Claims</h2><span style={{ flex: 1 }} />
        <ClaimForm clients={clients} policies={policiesByClient} />
      </div>
      <div style={{ ...box, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Claim #</th><th style={th}>Patient</th><th style={th}>Insurer</th><th style={th}>Service</th><th style={th}>Claimed</th><th style={th}>Approved</th><th style={th}>Status</th><th style={th} /></tr></thead>
          <tbody>
            {claims.map((c) => {
              const [bg, color] = chipFor(c.status);
              return (
                <tr key={c.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{c.claim_number ?? "—"}</td>
                  <td style={td}>{c.clients ? <Link href={`/clients/${c.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{c.clients.name}</Link> : "—"}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{c.insurers?.name ?? "—"}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{c.service_desc ?? "—"}</td>
                  <td style={td}>{money(c.amount_claimed)}</td>
                  <td style={td}>{c.amount_approved != null ? money(c.amount_approved) : "—"}</td>
                  <td style={td}><span style={{ background: bg, color, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{c.status.replace("_", " ")}</span></td>
                  <td style={{ ...td, textAlign: "right" }}><ClaimActions id={c.id} status={c.status} claimed={c.amount_claimed} /></td>
                </tr>
              );
            })}
            {claims.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No claims yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* policies */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Patient policies</h2><span style={{ flex: 1 }} />
        <PolicyForm clients={clients} insurers={insurers} />
      </div>
      <div style={{ ...box, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Patient</th><th style={th}>Insurer</th><th style={th}>Policy #</th><th style={th}>Coverage</th><th style={th}>Valid to</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>{p.clients ? <Link href={`/clients/${p.clients.id}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{p.clients.name}</Link> : "—"}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{p.insurers?.name ?? "—"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{p.policy_number ?? "—"}</td>
                <td style={td}>{money(p.coverage_amount)}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{p.valid_to ?? "—"}</td>
                <td style={td}><span style={{ background: p.status === "active" ? "var(--green-bg)" : "#eef2f1", color: p.status === "active" ? "#166534" : "var(--muted)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{p.status}</span></td>
              </tr>
            ))}
            {policies.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No policies recorded.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* insurers */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Insurers / payers</h2><span style={{ flex: 1 }} />
        <InsurerForm />
      </div>
      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Type</th><th style={th}>Contact</th></tr></thead>
          <tbody>
            {insurers.map((i) => (
              <tr key={i.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{i.name}</td>
                <td style={{ ...td, textTransform: "uppercase", fontSize: 12, color: "var(--muted)" }}>{i.kind}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{i.contact ?? "—"}</td>
              </tr>
            ))}
            {insurers.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No insurers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
