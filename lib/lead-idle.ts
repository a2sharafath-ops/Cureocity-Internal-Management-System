// High-value leads that have gone quiet.
//
// This is the "we have ₹4 lakh of pipeline that could close it" alert. The
// forecast maths already existed in lib/pipeline.ts but was only ever rendered
// on the reports page — nothing watched it, so a large deal could sit untouched
// indefinitely and the first anyone knew was a month-end number.
//
// SHIPPED DORMANT, ON PURPOSE.
//
// At the time of writing, 0 of 999 leads carry an `expected_value` and 0 carry
// an `expected_close`. The columns exist (migration 0082) and the UI to set
// them exists (components/LeadOpportunity.tsx) — nobody has used them yet. So
// this sweep will find nothing and send nothing until the front desk starts
// entering amounts, at which point it begins working with no further deploy.
//
// That is a deliberate trade: the alternative is remembering to build it later,
// on the day somebody notices a big deal went cold. The cost of it sitting
// silent is zero; the cost of not having it the first time it matters is a
// deal.

export type IdleLead = {
  id: string;
  name: string;
  owner_id: string | null;
  stage: string | null;
  expected_value: number | string | null;
  expected_close: string | null;
  disqualified_at?: string | null;
  /** most recent remark, appointment or callback — whichever is latest */
  last_touch: string | null;
};

/**
 * Money that makes a lead worth chasing individually rather than in a digest.
 *
 * ₹15,000 is the median active package price — Comprehensive 4-week, Facility
 * 12-week, and everything above. Below this the daily coverage digest is the
 * right instrument; above it, a deal going quiet deserves its own alert.
 */
export const HIGH_VALUE = 15_000;

/** Days without any recorded contact before a high-value lead is "idle". */
export const IDLE_AFTER_DAYS = 7;

/** Days without contact before management is told as well as the owner. */
export const IDLE_ESCALATE_DAYS = 14;

/** Closing date within this window makes an idle deal urgent regardless of age. */
export const CLOSING_SOON_DAYS = 14;

export const amount = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : 0;
};

const daysSince = (iso: string | null, todayISO: string): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.parse(`${todayISO}T00:00:00Z`) - t) / 86_400_000);
};

/** Still winnable: not won, not lost, not disqualified. */
export function isLive(l: IdleLead): boolean {
  if (l.disqualified_at) return false;
  const s = l.stage ?? "";
  return s !== "LOST" && !s.startsWith("5");
}

export type IdleVerdict = {
  status: "ok" | "idle" | "escalated";
  /** days since anything was recorded against this lead */
  quietFor: number;
  value: number;
  /** expected close is inside CLOSING_SOON_DAYS — raises urgency */
  closingSoon: boolean;
  reason: string;
};

export function idleVerdict(l: IdleLead, todayISO: string): IdleVerdict | null {
  if (!isLive(l)) return null;

  const value = amount(l.expected_value);
  // No amount means no judgement — silence rather than a guess. This is what
  // keeps the sweep dormant until the team starts valuing leads.
  if (value < HIGH_VALUE) return null;

  // Never touched at all is still "quiet since it arrived", but we have no
  // date to measure from, so treat an absent last_touch as maximally quiet
  // only if we were given one to begin with. A null here means the caller
  // could not determine contact history; don't invent a breach from it.
  const quietFor = daysSince(l.last_touch, todayISO);
  if (quietFor === null) return null;

  const closeIn = daysSince(l.expected_close, todayISO);
  // negative daysSince == the date is in the future
  const closingSoon = closeIn !== null && closeIn >= -CLOSING_SOON_DAYS && closeIn <= 0;

  // A deal closing inside two weeks earns an alert sooner than one with no
  // date — the window to influence it is shorter.
  const threshold = closingSoon ? Math.ceil(IDLE_AFTER_DAYS / 2) : IDLE_AFTER_DAYS;

  if (quietFor < threshold) {
    return { status: "ok", quietFor, value, closingSoon, reason: "" };
  }

  const status = quietFor >= IDLE_ESCALATE_DAYS ? "escalated" : "idle";
  const reason = closingSoon
    ? `expected to close within ${CLOSING_SOON_DAYS} days and no contact for ${quietFor} days`
    : `no contact for ${quietFor} days`;
  return { status, quietFor, value, closingSoon, reason };
}

export const money = (n: number): string => "₹" + Math.round(n).toLocaleString("en-IN");

export function alertTitle(l: IdleLead, v: IdleVerdict): string {
  return `${money(v.value)} deal going quiet — ${l.name}`;
}

export function alertBody(v: IdleVerdict): string {
  return v.status === "escalated"
    ? `${v.reason}. Owner has had ${IDLE_ESCALATE_DAYS} days.`
    : v.reason.charAt(0).toUpperCase() + v.reason.slice(1) + ".";
}

/** Total value sitting idle — the headline number for a management summary. */
export function idleTotal(leads: IdleLead[], todayISO: string): { count: number; value: number } {
  let count = 0, value = 0;
  for (const l of leads) {
    const v = idleVerdict(l, todayISO);
    if (!v || v.status === "ok") continue;
    count++; value += v.value;
  }
  return { count, value };
}
