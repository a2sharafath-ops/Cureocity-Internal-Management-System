// Month-over-month baselines for metric cards (slot 04).
//
// See docs/metric-card-anatomy.md. The rule this file exists to enforce:
// direction is arithmetic, sentiment is editorial, and sentiment is never
// derived from the sign. Revenue up is good; outstanding up is bad; headcount
// up is neither. Inferring colour from the delta would render rising debt in
// green, which is worse than showing no trend at all.

import type { Trend } from "@/components/MetricCard";

/** "2026-07" for the month containing `iso`, or the current month. */
export function monthKey(iso?: string): string {
  return (iso ?? new Date().toISOString()).slice(0, 7);
}

/** The month before `key`. Handles the January rollover. */
export function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export type Direction = "up-good" | "up-bad";

/**
 * Build a trend, or return undefined when one would mislead.
 *
 * Undefined — meaning the card simply omits slot 04 — in three cases:
 *   • no prior period at all (null): nothing to compare against;
 *   • prior period is zero: every percentage is either ▲∞ or ▲100%, which
 *     says "we went from nothing to something" far less clearly than the
 *     value itself already does;
 *   • both periods are zero: there is no story.
 *
 * A first-month metric showing "▲ 100%" is the single most common way these
 * cards lie, so the guard is deliberate rather than defensive.
 */
export function monthTrend(
  current: number,
  previous: number | null | undefined,
  direction: Direction,
  since = "vs last month",
): Trend | undefined {
  if (previous == null || previous === 0) return undefined;
  if (current === previous) {
    return { delta: 0, sentiment: "neutral", since };
  }
  const delta = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (delta === 0) return { delta: 0, sentiment: "neutral", since };

  const rose = current > previous;
  const good = direction === "up-good" ? rose : !rose;
  return { delta, sentiment: good ? "good" : "bad", since };
}

/**
 * Sum a numeric field over rows whose date falls in `key`'s month.
 * Rows with a null/short date are skipped rather than counted as zero — an
 * undated invoice is unknown, not free.
 */
export function sumInMonth<T>(
  rows: T[],
  key: string,
  dateOf: (r: T) => string | null | undefined,
  amountOf: (r: T) => number = () => 1,
): number {
  let total = 0;
  for (const r of rows) {
    const d = dateOf(r);
    if (typeof d === "string" && d.slice(0, 7) === key) total += Number(amountOf(r)) || 0;
  }
  return total;
}

/** Count rows dated within `key`'s month. */
export function countInMonth<T>(
  rows: T[],
  key: string,
  dateOf: (r: T) => string | null | undefined,
): number {
  return sumInMonth(rows, key, dateOf, () => 1);
}
