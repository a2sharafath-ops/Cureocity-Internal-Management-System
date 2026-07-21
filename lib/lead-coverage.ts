// "Which of my leads have no next step?" — the question the existing callback
// sweep structurally cannot answer.
//
// lib/cron/lead-followups.ts filters on `next_follow_up IS NOT NULL`, so it can
// only chase leads somebody already committed to. At the time of writing that
// was zero leads out of 999, meaning that sweep had never sent a single
// notification, while 847 open leads sat with no next step at all.
//
// This is the inverse query. Two design choices follow from the numbers:
//
//   DIGEST, NOT PER-LEAD.  A per-lead alert would have fired ~818 times on the
//   first night. That is not a notification system, it is a reason to mute
//   notifications. One digest per owner per day stays useful at any backlog
//   size, including when the backlog is finally zero.
//
//   BANDED BY AGE.  423 of the 847 are over 90 days old. Counting them the same
//   as a lead added yesterday produces a number that never moves and therefore
//   never prompts action. Banding separates "call these today" from "decide
//   whether these are still real".

export type CoverageLead = {
  id: string;
  owner_id: string | null;
  stage: string | null;
  created_at: string | null;
  next_follow_up: string | null;
  disqualified_at?: string | null;
};

/** Age bands, newest first. `from` is inclusive, `to` exclusive. */
export const BANDS = [
  { key: "fresh",   label: "added this week",  from: 0,  to: 7,        tone: "red"     },
  { key: "recent",  label: "1–2 weeks old",    from: 7,  to: 14,       tone: "amber"   },
  { key: "aging",   label: "2–4 weeks old",    from: 14, to: 30,       tone: "amber"   },
  { key: "old",     label: "1–3 months old",   from: 30, to: 90,       tone: "neutral" },
  { key: "stale",   label: "90+ days old",     from: 90, to: Infinity, tone: "neutral" },
] as const;

export type BandKey = (typeof BANDS)[number]["key"];

export const daysBetween = (fromISO: string, toISO: string): number =>
  Math.floor((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86_400_000);

/**
 * Still in play: not won, not lost, not disqualified. Mirrors isOpenStage in
 * lib/pipeline.ts — kept as its own function because a lead can be
 * disqualified while its stage still reads open, and that distinction is the
 * whole point of migration 0082.
 */
export function isOpen(l: CoverageLead): boolean {
  if (l.disqualified_at) return false;
  const s = l.stage ?? "";
  return s !== "LOST" && !s.startsWith("5");
}

/** Open, and nobody has committed to a next step. */
export function needsNextStep(l: CoverageLead): boolean {
  return isOpen(l) && !l.next_follow_up;
}

export function bandFor(l: CoverageLead, todayISO: string): BandKey | null {
  const created = (l.created_at ?? "").slice(0, 10);
  if (!created) return null;
  const age = daysBetween(created, todayISO);
  if (age < 0) return "fresh";                    // clock skew — treat as new
  return BANDS.find((b) => age >= b.from && age < b.to)?.key ?? "stale";
}

export type CoverageSummary = {
  total: number;
  byBand: Record<BandKey, number>;
  /** fresh + recent — the ones still genuinely workable */
  actionable: number;
  /** 90+ days — review or disqualify rather than call */
  stale: number;
};

export function summarise(leads: CoverageLead[], todayISO: string): CoverageSummary {
  const byBand = Object.fromEntries(BANDS.map((b) => [b.key, 0])) as Record<BandKey, number>;
  let total = 0;
  for (const l of leads) {
    if (!needsNextStep(l)) continue;
    const b = bandFor(l, todayISO);
    if (!b) continue;               // undated rows can't be aged; excluded, not bucketed
    byBand[b]++; total++;
  }
  return {
    total,
    byBand,
    actionable: byBand.fresh + byBand.recent,
    stale: byBand.stale,
  };
}

/** Group by owner so each person gets their own digest. */
export function byOwner(
  leads: CoverageLead[],
  todayISO: string,
): Map<string, CoverageSummary> {
  const groups = new Map<string, CoverageLead[]>();
  for (const l of leads) {
    if (!needsNextStep(l) || !l.owner_id) continue;   // unowned can't be digested
    const g = groups.get(l.owner_id) ?? [];
    g.push(l); groups.set(l.owner_id, g);
  }
  const out = new Map<string, CoverageSummary>();
  for (const [owner, ls] of groups) out.set(owner, summarise(ls, todayISO));
  return out;
}

/**
 * The digest line. Leads with the sharpest claim on attention come first, and
 * the stale bucket is phrased as a decision ("review or disqualify") rather
 * than as work, because calling a 2-year-old lead is rarely the right move.
 */
export function digestBody(s: CoverageSummary): string {
  const parts: string[] = [];
  if (s.byBand.fresh)  parts.push(`${s.byBand.fresh} added this week need a first call`);
  if (s.byBand.recent) parts.push(`${s.byBand.recent} now 1–2 weeks old`);
  if (s.byBand.aging)  parts.push(`${s.byBand.aging} aging 2–4 weeks`);
  if (s.byBand.old)    parts.push(`${s.byBand.old} over a month`);
  if (s.byBand.stale)  parts.push(`${s.byBand.stale} past 90 days — review or disqualify`);
  return parts.join(" · ");
}

export function digestTitle(s: CoverageSummary): string {
  return `${s.total} lead${s.total === 1 ? "" : "s"} with no next step`;
}

/**
 * Digest-worthy at all? A person with nothing outstanding should hear nothing —
 * a daily "you have 0" is how a channel gets muted.
 */
export function shouldNotify(s: CoverageSummary): boolean {
  return s.total > 0;
}
