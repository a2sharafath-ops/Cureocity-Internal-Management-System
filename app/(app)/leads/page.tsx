import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, homeFor } from "@/lib/roles";
import LeadStageSelect from "@/components/LeadStageSelect";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MetricCard from "@/components/MetricCard";
import SegTabs from "@/components/SegTabs";
import { leadScore, leadProduct, TIER_STYLE, type Tier } from "@/lib/leadscore";
import Link from "next/link";
import { LeadForm, CallCell } from "@/components/LeadControls";
import LeadSearch from "@/components/LeadSearch";
import { matchesLeadQuery } from "@/lib/leadsearch";
import { namesMatch } from "@/lib/staff-directory";
import { monthKey, prevMonthKey, countInMonth } from "@/lib/trend";
import { ivrStatus } from "@/lib/ivr/config";

export const dynamic = "force-dynamic";

type Lead = {
  id: string; name: string; phone: string | null; source: string | null; campaign: string | null;
  interest: string | null; urgency: string | null; history: string | null; goals: string | null;
  location: string | null; budget: string | null; profession: string | null;
  stage: string | null; fde: string | null; created_at: string | null;
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

// Every row carries two client components (the stage select and the call
// button), so rendering all 999 meant ~2000 components hydrating on load. The
// table is sorted by score, so the rows that matter are at the top.
const PAGE_SIZE = 100;

// `leads.fde` holds the short first names the Excel import came with — "Sini",
// "Tamanna", "Rohin". Staff rows use full names, so resolve one to the other
// for display. "Tamanna" is a genuine spelling variant of "Thamanna Nazer" and
// won't prefix-match, hence the explicit alias; "Rohin" has no staff row at
// all (pruned in 0069), so those leads show the raw name marked as off-team.
const FDE_ALIASES: Record<string, string> = { tamanna: "Thamanna Nazer" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { view?: string; stage?: string; tier?: string; q?: string; n?: string };
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
  const q = (searchParams.q ?? "").trim();
  const shown = Math.max(PAGE_SIZE, Number(searchParams.n) || PAGE_SIZE);
  const supabase = createClient();
  const [{ data, error }, { data: campRows }, { data: clientRows }, { data: staffRows }] = await Promise.all([
    supabase.from("leads").select("id, name, phone, source, campaign, interest, urgency, history, goals, location, budget, profession, stage, fde, created_at").order("num", { ascending: true }),
    supabase.from("campaigns").select("name").order("created_at", { ascending: false }).limit(30),
    // On a CRM-only deployment there is no client page to link to, and the
    // pilot may not have client access — this lookup only powers the
    // "converted → open client" link, so skip it.
    canSee(me.role, "/clients")
      ? supabase.from("clients").select("id, converted_from")
      : Promise.resolve({ data: [] }),
    supabase.from("staff").select("name"),
  ]);
  const leads = (data ?? []) as Lead[];
  // lead id -> client id, for leads that have converted into a client
  const clientByLead = new Map<string, string>();
  for (const c of (clientRows ?? []) as { id: string; converted_from: string | null }[]) {
    if (c.converted_from) clientByLead.set(c.converted_from, c.id);
  }
  const campaigns = [...new Set(((campRows ?? []) as { name: string }[]).map((c) => c.name))];

  // Resolve the imported short name to the staff directory's full name, so the
  // column matches how the same person is named everywhere else in the app.
  const staffNames = ((staffRows ?? []) as { name: string }[]).map((s) => s.name);
  const fdeName = (raw: string | null): { name: string; onTeam: boolean } | null => {
    const v = (raw ?? "").trim();
    if (!v) return null;
    const alias = FDE_ALIASES[v.toLowerCase()];
    const full = alias ?? staffNames.find((s) => namesMatch(s, v));
    return full ? { name: full, onTeam: true } : { name: v, onTeam: false };
  };
  // Search narrows everything upstream of the tabs, so every count on the page
  // — view tabs, stage chips, tier cards — reports matches within the search
  // rather than across the whole book. Same invariant the other filters keep.
  const matched = q ? leads.filter((l) => matchesLeadQuery(l, q)) : leads;
  const viewCount = (k: ViewKey) => matched.filter((l) => VIEWS[k].match(l.stage ?? "")).length;

  // Score everything once, then narrow. Counts on the tabs and cards reflect
  // the *other* filters that are active, so they always tell you how many rows
  // clicking would actually give you.
  const all = matched.map((l) => ({ lead: l, ...leadScore(l), product: leadProduct(l) }));
  const inView = all.filter((s) => VIEWS[view].match(s.lead.stage ?? ""));

  const matchesTier = (s: (typeof all)[number]) =>
    !tierFilter || (tierFilter === "converting" ? isConverting(s.lead.stage) : s.tier === tierFilter);
  const matchesStage = (s: (typeof all)[number]) => !stageFilter || s.lead.stage === stageFilter;

  const stageCount = (key: string) => inView.filter((s) => s.lead.stage === key && matchesTier(s)).length;
  const tierCount = (t: Tier) => inView.filter((s) => s.tier === t && matchesStage(s)).length;
  const convertingCount = inView.filter((s) => isConverting(s.lead.stage) && matchesStage(s)).length;

  // Tier cards count every lead in that tier, ever — a cumulative number that
  // only ever grows, so a "vs last month" arrow on it would be meaningless in
  // the same way it is on all-time revenue. What IS comparable is the inflow:
  // how many arrived this month against last. That goes in slot 03 as context,
  // beside a cumulative value, rather than in slot 04 as a trend on it.
  const thisMonth = monthKey();
  const lastMonth = prevMonthKey(thisMonth);
  const inflow = (rows: typeof inView) => ({
    now: countInMonth(rows, thisMonth, (r) => r.lead.created_at),
    prev: countInMonth(rows, lastMonth, (r) => r.lead.created_at),
  });
  const inflowSub = (rows: typeof inView) => {
    const { now, prev } = inflow(rows);
    if (!now && !prev) return undefined;          // nothing dated — say nothing
    return prev ? `${now} new this month · ${prev} last` : `${now} new this month`;
  };

  const scored = inView
    .filter((s) => matchesStage(s) && matchesTier(s))
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
  const visible = scored.slice(0, shown);

  // Build a URL that toggles one filter and preserves the rest.
  const href = (patch: { view?: string; stage?: string | null; tier?: string | null }) => {
    const p = new URLSearchParams();
    const v = patch.view ?? view;
    if (v !== "all") p.set("view", v);
    const st = patch.stage === undefined ? stageFilter : patch.stage;
    if (st) p.set("stage", st);
    const ti = patch.tier === undefined ? tierFilter : patch.tier;
    if (ti) p.set("tier", ti);
    if (q) p.set("q", q);   // filters compose with the search, never clear it
    const s = p.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  const ivr = ivrStatus();

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14 };
  // A stat card that filters the list. Clicking the active one clears it, so
  // the cards behave like toggles rather than a one-way trip.
  const statLink = (label: string, value: number, tier: TierKey, color: string, sub?: string) => {
    const on = tierFilter === tier;
    // The card owns its own drill-down now (slot 05) — this wrapper is only
    // here to draw the active outline.
    return (
      <div style={{ flex: 1, minWidth: 150, borderRadius: "var(--radius)", outline: on ? `2px solid ${color}` : "none", outlineOffset: -1 }}>
        <MetricCard
          label={on ? `${label}  ✓` : label}
          value={String(value)}
          sub={sub}
          color={color}
          href={href({ tier: on ? null : tier })}
        />
      </div>
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

      <LeadSearch
        initial={q}
        params={{ view, stage: stageFilter ?? undefined, tier: tierFilter ?? undefined }}
        count={q ? matched.length : null}
      />

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
        {statLink("HOT", tierCount("HOT"), "HOT", "var(--red)", inflowSub(inView.filter((s) => s.tier === "HOT" && matchesStage(s))))}
        {statLink("WARM", tierCount("WARM"), "WARM", "var(--amber-text-soft)", inflowSub(inView.filter((s) => s.tier === "WARM" && matchesStage(s))))}
        {statLink("COOL", tierCount("COOL"), "COOL", "var(--blue)", inflowSub(inView.filter((s) => s.tier === "COOL" && matchesStage(s))))}
        {statLink("Converting (Visit/Close)", convertingCount, "converting", "var(--brand-text)", inflowSub(inView.filter((s) => isConverting(s.lead.stage) && matchesStage(s))))}
      </div>

      {(stageFilter || tierFilter) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12.5, color: "var(--muted)" }}>
          <span>
            Showing <b style={{ color: "var(--ink)" }}>{scored.length}</b> of {inView.length}
            {stageFilter ? ` · ${STAGES.find((s) => s.key === stageFilter)?.label}` : ""}
            {tierFilter ? ` · ${tierFilter === "converting" ? "Converting" : tierFilter}` : ""}
          </span>
          <Link href={q ? `/leads?q=${encodeURIComponent(q)}` : "/leads"} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>
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
                <th style={th}>Front desk</th>
                <th style={th}>Stage</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ lead: l, total, tier, product }) => (
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
                  <td style={td}>
                    {(() => {
                      const f = fdeName(l.fde);
                      if (!f) return <span style={{ color: "var(--muted)" }}>—</span>;
                      return (
                        <span
                          title={f.onTeam ? undefined : "No longer in the staff directory"}
                          style={{ color: f.onTeam ? "var(--ink)" : "var(--muted)", fontStyle: f.onTeam ? undefined : "italic" }}
                        >
                          {f.name}
                        </span>
                      );
                    })()}
                  </td>
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
              {scored.length === 0 && (
                <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 16px" }}>
                  {leads.length === 0
                    ? "No leads yet"
                    : q
                      ? `No lead matches “${q}”`
                      : "No leads in this view"}
                </td></tr>
              )}
            </tbody>
          </table>

          {/* Rows are score-sorted, so the top of the list is the part that
              matters. Loading the rest is opt-in rather than the default. */}
          {scored.length > visible.length && (
            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "var(--muted)" }}>
              <span>Showing the top <b style={{ color: "var(--ink)" }}>{visible.length}</b> of {scored.length} by score</span>
              <span style={{ flex: 1 }} />
              <Link href={href({}) + (href({}).includes("?") ? "&" : "?") + `n=${visible.length + PAGE_SIZE}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>
                Show {Math.min(PAGE_SIZE, scored.length - visible.length)} more
              </Link>
              <Link href={href({}) + (href({}).includes("?") ? "&" : "?") + `n=${scored.length}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>
                Show all {scored.length}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
