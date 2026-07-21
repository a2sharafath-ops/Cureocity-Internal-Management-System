// Weighted pipeline — the forward-looking number.
//
// Sales Targets could only ever say "we're at 60% of target". It could not say
// "and there's ₹4 lakh in the pipeline that could close it", because no lead
// carried an amount. This file turns expected value plus stage probability
// into that sentence.
//
// Two numbers, and conflating them is the classic forecasting mistake:
//
//   OPEN PIPELINE   the raw sum of everything still in play. Big, motivating,
//                   and wrong — it assumes every deal closes.
//   WEIGHTED        each deal multiplied by its stage's close rate. Smaller,
//                   duller, and the one to plan against.
//
// Both are shown, because a manager needs the raw number to know how much
// activity exists and the weighted number to know what to expect.

import type { Trend } from "@/components/MetricCard";

/**
 * Probability a lead at this stage eventually closes.
 *
 * These are estimates, not measurements — the app has never had the data to
 * derive them, because the stage a lost lead died in was never retained
 * alongside an amount. Once a few months of `expected_value` plus outcome
 * exist, these should be replaced with observed rates. Until then they are
 * deliberately conservative: overstating pipeline is how a team misses a
 * target it thought it would beat.
 *
 * The overall conversion rate in the audit was 6.3%, so a New Lead at 5% is
 * roughly calibrated to reality rather than to optimism.
 */
export const STAGE_PROBABILITY: Record<string, number> = {
  "1-New Lead": 0.05,
  "2-Discovery": 0.15,
  "3-Product Match": 0.30,
  "4-Visit/Trial": 0.50,
  "5-Close": 1.00,     // won — counted as revenue, not pipeline
  "6-Nurture": 0.10,
  LOST: 0,
};

/** Stages that are still in play. Won, lost and disqualified are not pipeline. */
export function isOpenStage(stage: string | null | undefined): boolean {
  const s = stage ?? "";
  return s !== "LOST" && !s.startsWith("5");
}

export type PipelineLead = {
  stage: string | null;
  expected_value: number | string | null;
  expected_close: string | null;
  disqualified_at?: string | null;
};

export type PipelineTotals = {
  /** raw sum of open deals with a value */
  open: number;
  /** sum × stage probability — the number to plan against */
  weighted: number;
  /** open deals carrying a value */
  counted: number;
  /** open deals with NO value set — the blind spot, shown so it can't hide */
  unvalued: number;
  /**
   * Weighted value expected to land inside a window.
   *
   * `fromISO` is required and was the bug: the original took only an end date
   * and summed every dated deal with `close <= end`. A deal whose close date
   * has already passed therefore counted towards "could close this month",
   * for every month thereafter, forever — the number could only grow, and
   * silently overstated the forecast the longer the app ran.
   *
   * Deals whose date has slipped are not lost, but they are also not evidence
   * about this month. They surface separately as `overdueValue`.
   */
  weightedBy: (fromISO: string, toISO: string) => number;
  /** weighted value whose expected close date has already passed */
  overdueValue: (todayISO: string) => number;
};

const amount = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n as number) && (n as number) > 0 ? (n as number) : 0;
};

export function pipelineTotals(leads: PipelineLead[]): PipelineTotals {
  // Disqualified leads are excluded even if their stage still looks open —
  // that's the entire point of the distinction.
  const live = leads.filter((l) => !l.disqualified_at && isOpenStage(l.stage));

  let open = 0, weighted = 0, counted = 0, unvalued = 0;
  const dated: { value: number; close: string }[] = [];

  for (const l of live) {
    const v = amount(l.expected_value);
    if (!v) { unvalued++; continue; }
    const p = STAGE_PROBABILITY[l.stage ?? ""] ?? 0;
    open += v;
    weighted += v * p;
    counted++;
    if (l.expected_close) dated.push({ value: v * p, close: l.expected_close });
  }

  return {
    open, weighted, counted, unvalued,
    weightedBy: (fromISO: string, toISO: string) =>
      dated.filter((d) => d.close >= fromISO && d.close <= toISO)
           .reduce((s, d) => s + d.value, 0),
    overdueValue: (todayISO: string) =>
      dated.filter((d) => d.close < todayISO).reduce((s, d) => s + d.value, 0),
  };
}

/** Per-stage breakdown, in pipeline order, for a funnel that shows money. */
export function pipelineByStage(leads: PipelineLead[]) {
  const live = leads.filter((l) => !l.disqualified_at && isOpenStage(l.stage));
  const keys = Object.keys(STAGE_PROBABILITY).filter((k) => isOpenStage(k));
  return keys.map((stage) => {
    const rows = live.filter((l) => (l.stage ?? "") === stage);
    const value = rows.reduce((s, l) => s + amount(l.expected_value), 0);
    return {
      stage,
      count: rows.length,
      value,
      weighted: value * (STAGE_PROBABILITY[stage] ?? 0),
      probability: STAGE_PROBABILITY[stage] ?? 0,
    };
  });
}

/**
 * How the weighted pipeline sits against a revenue target.
 *
 * `gap` is what's still missing after both booked revenue and expected
 * pipeline — the honest version of "can we make it?".
 */
export function targetOutlook(
  target: number,
  bookedRevenue: number,
  weightedPipeline: number,
): { attained: number; projected: number; gap: number; canMake: boolean } {
  const projected = bookedRevenue + weightedPipeline;
  return {
    attained: target > 0 ? Math.round((bookedRevenue / target) * 100) : 0,
    projected,
    gap: Math.max(0, target - projected),
    canMake: projected >= target,
  };
}

/** Trend-shaped so a MetricCard can consume it directly. */
export function pipelineTrend(
  now: number, prev: number | null,
): Trend | undefined {
  if (prev == null || prev === 0) return undefined;
  const delta = Math.round(((now - prev) / Math.abs(prev)) * 100);
  if (delta === 0) return { delta: 0, sentiment: "neutral", since: "vs last month" };
  return { delta, sentiment: now > prev ? "good" : "bad", since: "vs last month" };
}
