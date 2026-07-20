import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, homeFor } from "@/lib/roles";
import LeadStageSelect from "@/components/LeadStageSelect";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StatCard from "@/components/StatCard";
import SegTabs from "@/components/SegTabs";
import { leadScore, leadProduct, TIER_STYLE, type Tier } from "@/lib/leadscore";
import Link from "next/link";
import { LeadForm, CallCell } from "@/components/LeadControls";
import { ivrStatus } from "@/lib/ivr/config";

export const dynamic = "force-dynamic";

type Lead = {
  id: string; name: string; phone: string | null; source: string | null; campaign: string | null;
  interest: string | null; urgency: string | null; history: string | null; goals: string | null;
  location: string | null; budget: string | null; profession: string | null;
  stage: string | null; fde: string | null;
};

// Broad slices, kept because the owner dashboard's Growth cards link straight
// in with one of these. They compose with the stage and tier filters below.
const VIEWS = {
  all: { label: "All leads", match: () => true },
  open: { label: "In pipeline", match: (s: string) => !s.startsWith("5") && s !== "LOST" },
  won: { label: "Converted", match: (s: string) => s.startsWith("5") },
  lost: { label: "Lost", match: (s: string) => s === "LOST" },
} as const;
type ViewKey = keyof typeof VIEWS;

// Every pipeline stage, in the order a lead travels through them. `key` is the
// exact `stage` value stored on the row, so filtering is an equality check.
const STAGES = [
  { key: "1-New Lead", label: "New Lead" },
  { key: "2-Discovery", label: "Discovery" },
  { key: "3-Product Match", label: "Product Match" },
  { key: "4-Visit/Trial", label: "Visit / Trial" },
  { key: "5-Close", label: "Close" },
  { key: "6-Nurture", label: "Nurture" },
  { key: "LOST", label: "Lost" },
] as const;

// Tier filter — driven by the stat cards. "converting" isn't a score tier but a
// position in the pipeline (visit or close), which is what the card has always
// counted, so it filters the same way.
const TIERS = ["HOT", "WARM", "COOL", "COLD"] as const;
type TierKey = (typeof TIERS)[number] | "converting";
const isConverting = (stage: string | null) => Boolean((stage ?? "").match(/^(4|5)/));

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { view?: string; stage?: string; tier?: string };
}) {
  // This page had no guard — any signed-in user could reach it by URL.
  const me = await getProfile();
  if (!me || !canSee(me.role, "/leads")) redirect(homeFor(me?.role ?? "Staff"));

  const view = (Object.keys(VIEWS) as ViewKey[]).includes(searchParams.view as ViewKey)
    ? (searchParams.view as ViewKey)
    : "all";
  const stageFilter = STAGES.some((s) => s.key === searchParams.stage) ? searchParams.stage! : null;
  const tierFilter = ([...TIERS, "converting"] as string[]).includes(searchParams.tier ?? "")
    ? (searchParams.tier as TierKey)
    : null;
  const supabase = createClient();
  const [{ data, error }, { data: campRows }, { data: clientRows }] = await Promise.all([
    supabase.from("leads").select("id, name, phone, source, campaign, interest, urgency, history, goals, location, budget, profession, stage, fde").order("num", { ascending: true }),
    supabase.from("campaigns").select("name").order("created_at", { ascending: false }).limit(30),
    // On a CRM-only deployment there is no client page to link to, and the
    // pilot may not have client access — this lookup only powers the
    // "converted → open client" link, so skip it.
    canSee(me.role, "/clients")
      ? supabase.from("clients").select("id, converted_from")
      : Promise.resolve({ data: [] }),
  ]);
  const leads = (data ?? []) as Lead[];
  // lead id -> client id, for leads that have converted into a client
  const clientByLead = new Map<string, string>();
  for (const c of (clientRows ?? []) as { id: string; converted_from: string | null }[]) {
    if (c.converted_from) clientByLead.set(c.converted_from, c.id);
  }
  const campaigns = [...new Set(((campRows ?? []) as { name: string }[]).map((c) => c.name))];
  const viewCount = (k: ViewKey) => leads.filter((l) => VIEWS[k].match(l.stage ?? "")).length;

  // Score everything once, then narrow. Counts on the tabs and cards reflect
  // the *other* filters that are active, so they always tell you how many rows
  // clicking would actually give you.
  const all = leads.map((l) => ({ lead: l, ...leadScore(l), product: leadProduct(l) }));
  const inView = all.filter((s) => VIEWS[view].match(s.lead.stage ?? ""));

  const matchesTier = (s: (typeof all)[number]) =>
    !tierFilter || (tierFilter === "converting" ? isConverting(s.lead.stage) : s.tier === tierFilter);
  const matchesStage = (s: (typeof all)[number]) => !stageFilter || s.lead.stage === stageFilter;

  const stageCount = (key: string) => inView.filter((s) => s.lead.stage === key && matchesTier(s)).length;
  const tierCount = (t: Tier) => inView.filter((s) => s.tier === t && matchesStage(s)).length;
  const convertingCount = inView.filter((s) => isConverting(s.lead.stage) && matchesStage(s)).length;

  const scored = inView
    .filter((s) => matchesStage(s) && matchesTier(s))
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  // Build a URL that toggles one filter and preserves the rest.
  const href = (patch: { view?: string; stage?: string | null; tier?: string | null }) => {
    const p = new URLSearchParams();
    const v = patch.view ?? view;
    if (v !== "all") p.set("view", v);
    const st = patch.stage === undefined ? stageFilter : patch.stage;
    if (st) p.set("stage", st);
    const ti = patch.tier === undefined ? tierFilter : patch.tier;
    if (ti) p.set("tier", ti);
    const q = p.toString();
    return q ? `/leads?${q}` : "/leads";
  };

  const ivr = ivrStatus();

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14 };
  // A stat card that filters the list. Clicking the active one clears it, so
  // the cards behave like toggles rather than a one-way trip.
  const statLink = (label: string, value: number, tier: TierKey, color: string) => {
    const on = tierFilter === tier;
    return (
      <Link
        href={href({ tier: on ? null : tier })}
        style={{
          display: "block", textDecoration: "none", color: "inherit", flex: 1, minWidth: 150,
          borderRadius: "var(--radius)",
          outline: on ? `2px solid ${color}` : "none", outlineOffset: -1,
        }}
      >
        <StatCard label={on ? `${label}  ✓` : label} value={String(value)} color={color} />
      </Link>
    );
  };

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["leads"]} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>CRM &amp; Leads</h1>
        <span style={{ flex: 1 }} />
        <LeadForm campaigns={campaigns} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 12px" }}>
        Lead scoring — 7 signals, HOT / WARM / COOL / COLD tiers &amp; product match · {leads.length} lead{leads.length === 1 ? "" : "s"}
        {" · "}Call: {ivr.configured ? `IVR (${ivr.provider})` : "device dialer"}
      </p>

      <div style={{ marginBottom: 12 }}>
        <SegTabs
          active={view}
          items={(Object.keys(VIEWS) as ViewKey[]).map((k) => ({
            key: k, label: VIEWS[k].label, count: viewCount(k), href: href({ view: k }),
          }))}
        />
      </div>

      {/* stage filter — every step of the pipeline */}
      <div style={{ marginBottom: 14 }}>
        <SegTabs
          size="sm"
          active={stageFilter ?? "all"}
          items={[
            { key: "all", label: "All stages", count: inView.filter(matchesTier).length, href: href({ stage: null }) },
            ...STAGES.map((s) => ({
              key: s.key, label: s.label, count: stageCount(s.key), href: href({ stage: s.key }),
            })),
          ]}
        />
      </div>

      {/* tier cards — click to filter, click again to clear */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        {statLink("🔥 HOT", tierCount("HOT"), "HOT", "var(--red)")}
        {statLink("WARM", tierCount("WARM"), "WARM", "var(--amber-text-soft)")}
        {statLink("COOL", tierCount("COOL"), "COOL", "var(--blue)")}
        {statLink("Converting (Visit/Close)", convertingCount, "converting", "var(--brand-text)")}
      </div>

      {(stageFilter || tierFilter) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12.5, color: "var(--muted)" }}>
          <span>
            Showing <b style={{ color: "var(--ink)" }}>{scored.length}</b> of {inView.length}
            {stageFilter ? ` · ${STAGES.find((s) => s.key === stageFilter)?.label}` : ""}
            {tierFilter ? ` · ${tierFilter === "converting" ? "Converting" : tierFilter}` : ""}
          </span>
          <Link href={href({ stage: null, tier: null })} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>
            Clear filters
          </Link>
        </div>
      )}

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
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
                <th style={th}>Stage</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {scored.map(({ lead: l, total, tier, product }) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b>{l.name}</b>
                      {clientByLead.has(l.id) && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>✓ Client</span>}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{l.phone ?? "—"}{l.source ? ` · ${l.source}` : ""}</div>
                  </td>
                  <td style={{ ...td, color: "var(--muted)" }}>{l.interest ?? "—"}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{total ?? "—"}</td>
                  <td style={td}>{tier ? <span style={{ background: TIER_STYLE[tier].bg, color: TIER_STYLE[tier].color, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{tier}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{product}</td>
                  <td style={td}><LeadStageSelect id={l.id} stage={l.stage ?? "1-New Lead"} /></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                      <CallCell phone={l.phone} ivrConfigured={ivr.configured} />
                      {clientByLead.has(l.id) && <Link href={`/clients/${clientByLead.get(l.id)}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--green-text)", textDecoration: "none" }}>Client ↗</Link>}
                      <Link href={`/leads/${l.id}`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)", textDecoration: "none" }}>Open →</Link>
                    </div>
                  </td>
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
