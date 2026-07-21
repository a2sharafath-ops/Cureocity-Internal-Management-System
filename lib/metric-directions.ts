// Which way is up, per metric — decided once, here.
//
// The problem this closes: `monthTrend(x, y, "up-good")` let every call site
// make its own judgement about whether a rising number is good news. Nothing
// stopped someone passing "up-good" for churn, and the compiler would have
// accepted it and rendered rising churn in green. Direction is a property of
// the *metric*, not of the place it happens to be displayed, so it belongs in
// one table rather than at 13 call sites.
//
// Adding a metric here is a deliberate act: you have to state which way is up,
// and the reason lives beside it. Call sites pass a key from this table, so a
// typo is a compile error and a wrong direction is a one-line review.

export type Direction = "up-good" | "up-bad";

export const METRIC_DIRECTION = {
  // ---- money in -----------------------------------------------------------
  /** Cash collected this month. */
  revenue_month: "up-good",
  /** Revenue minus spend. Can legitimately go negative. */
  net_month: "up-good",
  /** Share of everything billed that has actually been paid. */
  collection_rate: "up-good",

  // ---- money owed or gone -------------------------------------------------
  /** Invoiced and unpaid. More debt on the book is worse, always. */
  outstanding: "up-bad",
  /** Unpaid past the due date — a strictly worse subset of outstanding. */
  overdue: "up-bad",
  /** Money handed back. Rising refunds signal a delivery or expectation
   *  problem, so up is bad even though the refund itself may be correct. */
  refunded: "up-bad",
  /** Operating cost. Up is bad in isolation — net_month is where spend that
   *  bought growth shows as a good outcome. */
  spend_month: "up-bad",
  /** Sold but never invoiced. Pure leakage. */
  unbilled: "up-bad",

  // ---- pipeline -----------------------------------------------------------
  /** New leads arriving. */
  leads_new: "up-good",
  /** Leads that reached Close. */
  converted: "up-good",
  /** Leads marked lost. */
  leads_lost: "up-bad",

  // ---- delivery -----------------------------------------------------------
  /** Sessions actually completed. */
  sessions_done: "up-good",
  /** Follow-ups past their due date. */
  followups_overdue: "up-bad",
  /** BluePrint turnaround commitments missed. */
  sla_breaches: "up-bad",

  // ---- people -------------------------------------------------------------
  /** Attendance rate. Not wired yet — the attendance table is empty until the
   *  team starts marking it. Listed so the direction is already decided. */
  attendance_rate: "up-good",
  /** Clients on an active package. */
  active_clients: "up-good",
} as const satisfies Record<string, Direction>;

/** Every metric the app is allowed to draw a trend for. */
export type MetricKey = keyof typeof METRIC_DIRECTION;

export function directionOf(metric: MetricKey): Direction {
  return METRIC_DIRECTION[metric];
}

// Deliberately NOT in this table, and why — so the next person doesn't add
// them by reflex:
//
//   total_revenue    all-time, only ever rises; a month-over-month delta on a
//                    cumulative figure is meaningless (see reports/page.tsx)
//   tier counts      same — HOT/WARM/COOL count every lead ever scored, so the
//                    comparable thing is inflow, which is `leads_new`
//   headcount        up is neither good nor bad; a growing team and a shrinking
//                    one are both fine depending on the plan. If it ever needs
//                    a trend it wants a third direction, not a forced choice.
