// Lead callback dates — due, overdue, and the escalation ladder.
//
// The sales audit found the follow-up date filled 17% of the time. In this app
// it didn't exist at all, so the first job is making it exist and the second is
// making it impossible to ignore.
//
// The ladder is deliberately short:
//   due today      → the owner is told, once
//   1 day late     → the owner is told again
//   3 days late    → management is told
// Escalating on day one would make managers the first line of chasing, which
// is how escalation stops meaning anything. Three days is long enough that the
// owner has genuinely dropped it.

export const ESCALATE_AFTER_DAYS = 3;

export type FollowupStatus =
  | "none"        // no callback date set
  | "future"      // set, not yet due
  | "due"         // due today
  | "late"        // 1–2 days past
  | "escalated";  // ESCALATE_AFTER_DAYS or more past

export type FollowupView = {
  status: FollowupStatus;
  /** negative = days overdue; 0 = today; positive = days away. null when unset */
  days: number | null;
  /** short human label for a table cell */
  label: string;
  /** true once it needs someone's attention today */
  actionable: boolean;
};

export function daysBetweenISO(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Where a lead's callback stands as of `today`.
 *
 * A date in the past with no remark since is the entire problem the audit
 * describes, so "late" and "escalated" are distinct states rather than one
 * "overdue" — they notify different people.
 */
export function followupView(
  nextFollowUp: string | null | undefined,
  today: string,
): FollowupView {
  if (!nextFollowUp) {
    return { status: "none", days: null, label: "No callback set", actionable: false };
  }
  // days from today to the due date: negative once the date has passed
  const days = daysBetweenISO(today, nextFollowUp);

  if (days > 0) {
    return {
      status: "future", days,
      label: days === 1 ? "Due tomorrow" : `Due in ${days} days`,
      actionable: false,
    };
  }
  if (days === 0) {
    return { status: "due", days, label: "Due today", actionable: true };
  }
  const late = Math.abs(days);
  if (late >= ESCALATE_AFTER_DAYS) {
    return { status: "escalated", days, label: `${late} days overdue`, actionable: true };
  }
  return {
    status: "late", days,
    label: late === 1 ? "1 day overdue" : `${late} days overdue`,
    actionable: true,
  };
}

export const FOLLOWUP_TONE: Record<FollowupStatus, { bg: string; color: string }> = {
  none:      { bg: "var(--neutral-bg)", color: "var(--muted)" },
  future:    { bg: "var(--blue-bg)",    color: "var(--blue-text)" },
  due:       { bg: "var(--amber-bg)",   color: "var(--amber-text)" },
  late:      { bg: "var(--amber-bg)",   color: "var(--amber-text)" },
  escalated: { bg: "var(--red-bg)",     color: "var(--red-text)" },
};

/** What a remark records. Drives the outcome chip and, later, the contactability
 *  reporting the audit asks for. */
export const REMARK_OUTCOMES = [
  { key: "reached",        label: "Spoke to them" },
  { key: "no_answer",      label: "No answer" },
  { key: "callback",       label: "Asked to call back" },
  { key: "not_interested", label: "Not interested" },
  { key: "note",           label: "Note only" },
] as const;

export type RemarkOutcome = (typeof REMARK_OUTCOMES)[number]["key"];

/** Outcomes that mean we actually got hold of the person. The audit's
 *  headline metric — 37% DNP — is the inverse of this. */
export function isContact(outcome: string | null | undefined): boolean {
  return outcome === "reached" || outcome === "callback" || outcome === "not_interested";
}

/** Suggested callback date for an outcome, as an offset in days. `null` means
 *  don't suggest one — "not interested" shouldn't nudge you to book a call. */
export const SUGGESTED_OFFSET: Record<RemarkOutcome, number | null> = {
  reached: 7,
  no_answer: 1,
  callback: 2,
  not_interested: null,
  note: null,
};

/**
 * Reasons a lead was never a real opportunity — distinct from LOST, which
 * means we competed and lost.
 *
 * Lives here rather than in lib/actions.ts because that file is `"use server"`
 * and may only export async functions. A const export there type-checks
 * cleanly and then throws at request time, taking the whole page with it.
 */
export const DISQUALIFY_REASONS = [
  { key: "unreachable",     label: "Never reachable" },
  { key: "wrong_number",    label: "Wrong number" },
  { key: "duplicate",       label: "Duplicate of another lead" },
  { key: "out_of_area",     label: "Outside our area" },
  { key: "not_our_service", label: "Wants something we don't offer" },
  { key: "spam",            label: "Spam / test entry" },
] as const;

export type DisqualifyReason = (typeof DISQUALIFY_REASONS)[number]["key"];
