import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, homeFor } from "@/lib/roles";
import LeadStageSelect from "@/components/LeadStageSelect";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import MetricCard from "@/components/MetricCard";
import SegTabs from "@/components/SegTabs";
import { leadScore, TIER_STYLE, type Tier } from "@/lib/leadscore";
import Link from "next/link";
import { LeadForm, CallCell } from "@/components/LeadControls";
import LeadFilters from "@/components/LeadFilters";
import { matchesLeadQuery } from "@/lib/leadsearch";
import { selectAll } from "@/lib/select-all";
import LeadSort from "@/components/LeadSort";
import { namesMatch } from "@/lib/staff-directory";
import { LEAD_OWNER_ROLES } from "@/lib/roles";
import { followupView, FOLLOWUP_TONE } from "@/lib/lead-followup";
import { monthKey, prevMonthKey, countInMonth } from "@/lib/trend";
import { ivrStatus } from "@/lib/ivr/config";
import { todayISO } from "@/lib/today";

export const dynamic = "force-dynamic";

type Lead = {
  id: string; name: string; phone: string | null; source: string | null; campaign: string | null;
  interest: string | null; urgency: string | null; history: string | null; goals: string | null;
  location: string | null; budget: string | null; profession: string | null;
  stage: string | null; fde: string | null; owner_id: string | null; created_at: string | null;
  disqualified_at: string | null;
  next_follow_up: string | null; follow_up_owner: string | null;
};

// Broad slices, kept because the owner dashboard's Growth cards link straight
// in with one of these. They compose with the stage and tier filters below.
type Viewable = { stage: string | null; disqualified_at: string | null };
const VIEWS = {
  all:  { label: "All leads",   match: () => true },
  // Disqualified is NOT pipeline — that distinction is the entire point of
  // 0082. Counting "never was a lead" as in-play understates every conversion
  // rate, because it inflates the denominator.
  open: { label: "In pipeline", match: (l: Viewable) =>
            !l.disqualified_at && !(l.stage ?? "").startsWith("5") && (l.stage ?? "") !== "LOST" },
  won:  { label: "Converted",   match: (l: Viewable) => (l.stage ?? "").startsWith("5") },
  lost: { label: "Lost",        match: (l: Viewable) => (l.stage ?? "") === "LOST" || Boolean(l.disqualified_at) },
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
  searchParams: {
    view?: string; stage?: string; tier?: string; q?: string; n?: string;
    /** date-wise search: created_at range, and a callback-due filter */
    from?: string; to?: string; due?: string;
    /** "1" = only leads owned by the signed-in user */
    mine?: string;
    /** filter to a single owner (staff id) */
    owner?: string;
    /** list order: score (default) | new | old | az | za */
    sort?: string;
  };
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
  // "My leads" — only offered when this login is linked to a staff row, since
  // ownership is by staff.id. Admins without one would otherwise see an empty
  // list and read it as data loss.
  const mine = searchParams.mine === "1" && Boolean(me.staffId);
  const shown = Math.max(PAGE_SIZE, Number(searchParams.n) || PAGE_SIZE);
  // Date-wise search. `from`/`to` bound when the lead arrived; `due` filters on
  // the callback date, which is the question front desk actually asks in the
  // morning ("what do I owe today?").
  const isDate = (v?: string) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  const from = isDate(searchParams.from) ? searchParams.from! : "";
  const to = isDate(searchParams.to) ? searchParams.to! : "";
  const due = ["today", "overdue", "week", "none"].includes(searchParams.due ?? "")
    ? searchParams.due! : "";
  const supabase = createClient();
  const [{ data, error }, { data: campRows }, { data: clientRows }, { data: staffRows }, { data: remarkRows }] = await Promise.all([
    // Page through every lead (newest first). The server caps a single response
    // at 1000 rows, so once the book passed 1000 leads the most recent ones
    // (num 1001+, e.g. every externally-captured Instagram/WhatsApp lead) fell
    // outside the window — invisible to the list, search and counts even though
    // they were in the database. selectAll walks the rows in 1000-row pages.
    selectAll((f, t) => supabase.from("leads").select("id, name, phone, source, campaign, interest, urgency, history, goals, location, budget, profession, stage, fde, owner_id, created_at, next_follow_up, follow_up_owner, disqualified_at").order("num", { ascending: false }).range(f, t)),
    supabase.from("campaigns").select("name").order("created_at", { ascending: false }).limit(30),
    // On a CRM-only deployment there is no client page to link to, and the
    // pilot may not have client access — this lookup only powers the
    // "converted → open client" link, so skip it.
    canSee(me.role, "/clients")
      ? supabase.from("clients").select("id, converted_from")
      : Promise.resolve({ data: [] }),
    supabase.from("staff").select("id, name, role"),
    // Newest first; we keep the first row seen per lead, which is the latest.
    supabase.from("lead_remarks")
      .select("lead_id, body, outcome, by_name, created_at")
      .order("created_at", { ascending: false }).limit(3000),
  ]);
  const leads = (data ?? []) as Lead[];
  // lead id -> client id, for leads that have converted into a client
  const clientByLead = new Map<string, string>();
  for (const c of (clientRows ?? []) as { id: string; converted_from: string | null }[]) {
    if (c.converted_from) clientByLead.set(c.converted_from, c.id);
  }
  const campaigns = [...new Set(((campRows ?? []) as { name: string }[]).map((c) => c.name))];

  // Latest remark per lead. Rows arrive newest-first, so the first one wins.
  const lastRemark = new Map<string, { body: string; outcome: string | null; by_name: string | null; created_at: string }>();
  for (const r of (remarkRows ?? []) as { lead_id: string; body: string; outcome: string | null; by_name: string | null; created_at: string }[]) {
    if (!lastRemark.has(r.lead_id)) lastRemark.set(r.lead_id, r);
  }

  // Resolve the imported short name to the staff directory's full name, so the
  // column matches how the same person is named everywhere else in the app.
  const staffNames = ((staffRows ?? []) as { name: string }[]).map((s) => s.name);
  // Who can be picked as an owner — front desk and management only.
  const assignable = ((staffRows ?? []) as { id: string; name: string; role: string }[])
    .filter((m) => LEAD_OWNER_ROLES.includes(m.role))
    .map((m) => ({ id: m.id, name: m.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Owner filter — validated against real staff ids so a junk value can't
  // strand the page on an empty list. "none" is the reserved unowned value.
  const ownerFilter = searchParams.owner === "none"
    ? "none"
    : (assignable.some((m) => m.id === searchParams.owner) ? searchParams.owner! : null);
  const byId = new Map(((staffRows ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name]));
  // owner_id is authoritative; `fde` is the pre-0083 fallback for any row the
  // backfill could not resolve.
  const ownerName = (l: { owner_id?: string | null; fde: string | null }): { name: string; onTeam: boolean } | null => {
    const byOwner = l.owner_id ? byId.get(l.owner_id) : undefined;
    if (byOwner) return { name: byOwner, onTeam: true };
    return fdeName(l.fde);
  };
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
  const inWeek = (d: string | null) => {
    if (!d) return false;
    const days = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${todayISO()}T00:00:00Z`)) / 86400000);
    return days >= 0 && days <= 7;
  };
  const matchesDates = (l: Lead) => {
    const created = (l.created_at ?? "").slice(0, 10);
    if (from && (!created || created < from)) return false;
    if (to && (!created || created > to)) return false;
    if (due === "today" && l.next_follow_up !== todayISO()) return false;
    if (due === "overdue" && !(l.next_follow_up && l.next_follow_up < todayISO())) return false;
    if (due === "week" && !inWeek(l.next_follow_up)) return false;
    if (due === "none" && l.next_follow_up) return false;
    return true;
  };
  const matched = leads.filter((l) =>
    (!q || matchesLeadQuery(l, q)) && matchesDates(l)
    && (!mine || l.owner_id === me.staffId)
    && (!ownerFilter || (ownerFilter === "none" ? !l.owner_id : l.owner_id === ownerFilter)));
  const viewCount = (k: ViewKey) => matched.filter((l) => VIEWS[k].match(l)).length;

  // Score everything once, then narrow. Counts on the tabs and cards reflect
  // the *other* filters that are active, so they always tell you how many rows
  // clicking would actually give you.
  const all = matched.map((l) => ({ lead: l, ...leadScore(l) }));
  const inView = all.filter((s) => VIEWS[view].match(s.lead));

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

  // List order is user-chosen (LeadSort). Score high→low stays the default
  // because that's the "work the best leads first" view; the others are for
  // finding a lead by arrival time or name.
  const sortKey = ["new", "old", "az", "za", "score"].includes(searchParams.sort ?? "") ? searchParams.sort! : "score";
  const ts = (s: string | null | undefined) => (s ? Date.parse(s) : 0);
  const comparators: Record<string, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
    score: (a, b) => (b.total ?? -1) - (a.total ?? -1),
    new: (a, b) => ts(b.lead.created_at) - ts(a.lead.created_at),
    old: (a, b) => ts(a.lead.created_at) - ts(b.lead.created_at),
    az: (a, b) => (a.lead.name ?? "").localeCompare(b.lead.name ?? ""),
    za: (a, b) => (b.lead.name ?? "").localeCompare(a.lead.name ?? ""),
  };
  const scored = inView
    .filter((s) => matchesStage(s) && matchesTier(s))
    .sort(comparators[sortKey]);
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
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (due) p.set("due", due);
    if (mine) p.set("mine", "1");
    if (ownerFilter) p.set("owner", ownerFilter);
    if (sortKey !== "score") p.set("sort", sortKey);
    const s = p.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  const ivr = ivrStatus();

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14 };
  // "23 Jul 2026, 11:49 AM" — the moment the lead arrived (created_at).
  const fmtAdded = (s: string | null) => s
    ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
    : "—";
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
        <LeadForm campaigns={campaigns} staff={assignable} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 12px" }}>
        Lead scoring — 7 signals, HOT / WARM / COOL / COLD tiers &amp; product match · {leads.length} lead{leads.length === 1 ? "" : "s"}
        {" · "}Call: {ivr.configured ? `IVR (${ivr.provider})` : "device dialer"}
      </p>

      <LeadFilters
        q={q}
        from={from}
        to={to}
        due={due}
        view={view}
        stage={stageFilter ?? undefined}
        tier={tierFilter ?? undefined}
        owners={assignable}
        owner={ownerFilter ?? ""}
        count={q ? matched.length : null}
        clearHref={href({ stage: stageFilter, tier: tierFilter }).replace(/[?&](from|to|due|owner)=[^&]*/g, "")}
      />

      {me.staffId && (
        <div style={{ marginBottom: 10 }}>
          <Link
            href={mine
              ? href({}).replace(/[?&]mine=1/, "").replace(/\?$/, "")
              : `${href({})}${href({}).includes("?") ? "&" : "?"}mine=1`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              border: `1px solid ${mine ? "var(--brand-fill)" : "var(--border)"}`,
              background: mine ? "var(--brand-tint)" : "#fff",
              color: mine ? "var(--brand-text)" : "var(--text)",
              borderRadius: 999, padding: "5px 14px", fontSize: 12.5,
              fontWeight: 600, textDecoration: "none",
            }}
          >
            {mine ? "✓ " : ""}My leads
            <span style={{ color: "var(--muted)", fontWeight: 500 }}>
              {leads.filter((l) => l.owner_id === me.staffId).length}
            </span>
          </Link>
        </div>
      )}

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

      {/* Ten columns don't fit a laptop viewport. `overflow: hidden` clipped
          the last one — the Open button was unreachable rather than merely
          off-screen. `overflowX: auto` lets it scroll; minWidth stops the
          browser crushing columns to unreadable widths first. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{scored.length} shown</span>
        <span style={{ flex: 1 }} />
        <LeadSort value={sortKey} />
      </div>

      {error ? (
        <div style={{ background: "var(--red-bg)", color: "var(--red-text)", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 14 }}>
          <b>Couldn&apos;t load leads.</b> {error.message}
        </div>
      ) : (
        <div style={{ ...box, overflowX: "auto", overflowY: "hidden" }}>
          <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Lead</th>
                <th style={th}>Score</th>
                <th style={th}>Tier</th>
                <th style={th}>Added</th>
                <th style={th}>Last remark</th>
                <th style={th}>Callback</th>
                <th style={th}>Owner</th>
                <th style={th}>Stage</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ lead: l, total, tier }) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b>{l.name}</b>
                      {clientByLead.has(l.id) && <span style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>✓ Client</span>}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{l.phone ?? "—"}{l.source ? ` · ${l.source}` : ""}</div>
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{total ?? "—"}</td>
                  <td style={td}>{tier ? <span style={{ background: TIER_STYLE[tier].bg, color: TIER_STYLE[tier].color, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{tier}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{fmtAdded(l.created_at)}</td>
                  <td style={{ ...td, maxWidth: 240 }}>
                    {(() => {
                      const r = lastRemark.get(l.id);
                      if (!r) return <span style={{ color: "var(--muted)" }}>—</span>;
                      return (
                        <>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.body}>
                            {r.body}
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                            {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {r.by_name ? ` · ${r.by_name}` : ""}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                  <td style={td}>
                    {(() => {
                      const v = followupView(l.next_follow_up, todayISO());
                      if (v.status === "none") return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;
                      const tone = FOLLOWUP_TONE[v.status];
                      return (
                        <>
                          <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {v.label}
                          </span>
                          <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>{l.next_follow_up}</div>
                        </>
                      );
                    })()}
                  </td>
                  <td style={td}>
                    {(() => {
                      const f = ownerName(l);
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
                <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 16px" }}>
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
