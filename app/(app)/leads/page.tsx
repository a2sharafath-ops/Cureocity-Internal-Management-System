import { createClient } from "@/lib/supabase/server";
import LeadStageSelect from "@/components/LeadStageSelect";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import { leadScore, leadProduct, TIER_STYLE, type Tier } from "@/lib/leadscore";

export const dynamic = "force-dynamic";

type Lead = {
  id: string; name: string; phone: string | null; source: string | null;
  interest: string | null; urgency: string | null; history: string | null; goals: string | null;
  location: string | null; budget: string | null; profession: string | null;
  stage: string | null; fde: string | null;
};

export default async function LeadsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, phone, source, interest, urgency, history, goals, location, budget, profession, stage, fde")
    .order("num", { ascending: true });

  const leads = (data ?? []) as Lead[];
  const scored = leads
    .map((l) => ({ lead: l, ...leadScore(l), product: leadProduct(l) }))
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  const tierCount = (t: Tier) => scored.filter((s) => s.tier === t).length;
  const converting = scored.filter((s) => (s.lead.stage ?? "").match(/^(4|5)/)).length;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14 };
  const stat = (label: string, value: string, color = "var(--teal-dark)") => (
    <div style={{ ...box, padding: "14px 16px", flex: 1, minWidth: 150 }}><div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div></div>
  );

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["leads"]} />
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>CRM &amp; Leads</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
        Lead scoring — 7 signals, HOT / WARM / COOL / COLD tiers &amp; product match · {leads.length} lead{leads.length === 1 ? "" : "s"}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        {stat("🔥 HOT", String(tierCount("HOT")), "var(--red)")}
        {stat("WARM", String(tierCount("WARM")), "#b45309")}
        {stat("COOL", String(tierCount("COOL")), "#2563eb")}
        {stat("Converting (Visit/Close)", String(converting))}
      </div>

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "#991b1b", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load leads.</b> {error.message}
        </div>
      ) : (
        <div style={{ ...box, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Lead</th>
                <th style={th}>Interest</th>
                <th style={th}>Score</th>
                <th style={th}>Tier</th>
                <th style={th}>Best-fit product</th>
                <th style={th}>FDE</th>
                <th style={th}>Stage</th>
              </tr>
            </thead>
            <tbody>
              {scored.map(({ lead: l, total, tier, product }) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}><b>{l.name}</b><div style={{ color: "var(--muted)", fontSize: 12 }}>{l.phone ?? "—"}{l.source ? ` · ${l.source}` : ""}</div></td>
                  <td style={{ ...td, color: "var(--muted)" }}>{l.interest ?? "—"}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{total ?? "—"}</td>
                  <td style={td}>{tier ? <span style={{ background: TIER_STYLE[tier].bg, color: TIER_STYLE[tier].color, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{tier}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{product}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{l.fde ?? "—"}</td>
                  <td style={td}><LeadStageSelect id={l.id} stage={l.stage ?? "1-New Lead"} /></td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 16px" }}>No leads yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
