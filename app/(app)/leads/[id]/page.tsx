import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { leadScore, leadProduct, LS, TIER_STYLE } from "@/lib/leadscore";
import { LeadEditForm, CallCell, type Lead } from "@/components/LeadControls";
import ConvertPanel from "@/components/ConvertPanel";
import { ivrStatus } from "@/lib/ivr/config";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");
const SIGNALS: { key: string; label: string }[] = [
  { key: "interest", label: "Interest" }, { key: "urgency", label: "Urgency" }, { key: "history", label: "History" },
  { key: "goals", label: "Goal" }, { key: "location", label: "Location" }, { key: "budget", label: "Budget" }, { key: "profession", label: "Profession" },
];

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/leads")) redirect("/dashboard");

  const supabase = createClient();
  const [{ data: leadRow }, { data: pkgRows }, { data: campRows }, { data: clientRows }] = await Promise.all([
    supabase.from("leads").select("id, name, phone, source, campaign, interest, urgency, history, goals, location, budget, profession, stage, fde, objection, notes").eq("id", params.id).maybeSingle(),
    supabase.from("packages").select("id, name, price, is_facility").eq("active", true).order("id"),
    supabase.from("campaigns").select("name").order("created_at", { ascending: false }).limit(30),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  if (!leadRow) notFound();
  const lead = leadRow as Lead;
  const packages = (pkgRows ?? []) as { id: string; name: string; price: number; is_facility: boolean }[];
  const campaigns = [...new Set(((campRows ?? []) as { name: string }[]).map((c) => c.name))];
  const clients = (clientRows ?? []) as { id: string; name: string }[];
  const ivr = ivrStatus();

  const { total, tier } = leadScore(lead);
  const product = leadProduct(lead);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" };
  const lblS: React.CSSProperties = { fontSize: 11, color: "var(--muted)" };
  const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff" };

  return (
    <div style={{ maxWidth: 900 }}>
      <Link href="/leads" style={{ color: "var(--teal-dark)", fontSize: 13, textDecoration: "none" }}>← CRM &amp; Leads</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "10px 0 18px" }}>
        <div>
          <h1 style={{ fontSize: 22, margin: "0 0 2px" }}>{lead.name}</h1>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{lead.phone ?? "—"}{lead.source ? ` · ${lead.source}` : ""}{lead.campaign ? ` · ${lead.campaign}` : ""} · {lead.stage ?? "1-New Lead"}</div>
        </div>
        <span style={{ flex: 1 }} />
        <CallCell phone={lead.phone} ivrConfigured={ivr.configured} />
      </div>

      {/* score breakdown */}
      <div style={{ ...box, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <b style={{ fontSize: 15 }}>Lead score</b>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{total ?? "—"}</span>
          {tier && <span style={{ background: TIER_STYLE[tier].bg, color: TIER_STYLE[tier].color, borderRadius: 999, padding: "2px 12px", fontSize: 12, fontWeight: 700 }}>{tier}</span>}
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--muted)", fontSize: 13 }}>Best-fit: <b style={{ color: "var(--teal-dark)" }}>{product}</b></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {SIGNALS.map((s) => {
            const val = (lead as unknown as Record<string, string | null>)[s.key];
            const pts = val && LS[s.key] && LS[s.key][val] !== undefined ? LS[s.key][val] : 0;
            return (
              <div key={s.key as string} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={lblS}>{s.label}</span><b style={{ fontSize: 13, color: pts > 0 ? "var(--teal-dark)" : "var(--muted)" }}>+{pts}</b></div>
                <div style={{ fontSize: 12, marginTop: 2 }}>{val ?? "—"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* edit details */}
      <div style={{ ...box, marginBottom: 16 }}>
        <b style={{ fontSize: 15 }}>Lead details</b>
        <div style={{ marginTop: 12 }}>
          <LeadEditForm lead={lead} campaigns={campaigns} />
        </div>
      </div>

      {/* convert — kept at the bottom */}
      <div style={{ ...box, background: "#f0fdf9" }}>
        <b style={{ fontSize: 15 }}>Convert to client</b>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 14px" }}>Pick a package &amp; offer, record referral, capture consent, and verify by OTP. On success the client, sessions and package invoice are created and you're taken to billing.</p>
        <ConvertPanel leadId={lead.id} phone={lead.phone} packages={packages.map((p) => ({ id: p.id, name: p.name, price: p.price }))} clients={clients} />
      </div>
    </div>
  );
}
