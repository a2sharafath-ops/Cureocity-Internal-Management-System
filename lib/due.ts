// How a pending item states when it was due, in one place.
//
// The attention panel had exactly one flag in eight that mentioned a date, and
// the client card phrased its two differently again. "High severity" tells you
// how bad a thing is; it does not tell you whether it is a day late or three
// weeks late, which is what decides who you ring first.

export type Due = { dueLabel: string; overdue: boolean };

const DAY = 86_400_000;

/** Whole days between two ISO dates (b − a), UTC, ignoring clock time. */
export function daysBetweenISO(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

export function fmtDay(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(+d) ? iso : d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: iso.length <= 10 ? "UTC" : "Asia/Kolkata",
  });
}

/**
 * A deadline that falls on a date — invoices, milestones, package ends.
 *
 * Reads as a person would say it: "due today", "due tomorrow", "3 days
 * overdue". An exact date alone makes the reader do the arithmetic.
 */
export function dueOn(dueISO: string | null | undefined, todayISO: string): Due | undefined {
  if (!dueISO) return undefined;
  const days = daysBetweenISO(todayISO, dueISO.slice(0, 10));
  if (days === 0) return { dueLabel: "due today", overdue: false };
  if (days === 1) return { dueLabel: "due tomorrow", overdue: false };
  if (days > 1) return { dueLabel: `due ${fmtDay(dueISO)} · in ${days} days`, overdue: false };
  const late = Math.abs(days);
  return { dueLabel: `was due ${fmtDay(dueISO)} · ${late} day${late === 1 ? "" : "s"} overdue`, overdue: true };
}

/**
 * Something that has been waiting since a date, with no hard deadline —
 * a blood report requested, a registration half-finished.
 *
 * `nudgeAfterDays` is when waiting stops being normal and starts being a
 * problem; before that it is stated without alarm.
 */
export function waitingSince(
  sinceISO: string | null | undefined,
  todayISO: string,
  nudgeAfterDays = 7,
): Due | undefined {
  if (!sinceISO) return undefined;
  const days = daysBetweenISO(sinceISO.slice(0, 10), todayISO);
  if (days <= 0) return { dueLabel: "requested today", overdue: false };
  const label = days === 1 ? "waiting 1 day" : `waiting ${days} days`;
  return { dueLabel: `${label} · since ${fmtDay(sinceISO)}`, overdue: days >= nudgeAfterDays };
}
