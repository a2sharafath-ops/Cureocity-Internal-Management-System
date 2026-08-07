// Getting rid of a consultation that shouldn't exist.
//
// Two different problems wear the same clothes:
//
//   • a booking made in error, or a duplicate — nothing was ever recorded, and
//     the row is noise. It should disappear.
//   • a consultation that happened and is being abandoned — the client didn't
//     turn up, or it was superseded. Something may already hang off it, and the
//     fact that it was scheduled at all is part of the record.
//
// So: CANCEL is the normal route and never destroys anything. DELETE exists
// only for the first case, and only when the row is provably empty.
//
// The reason for the asymmetry is that a consultation is not a standalone
// object. Lab orders and prescriptions carry `consultation_id`, and the lab
// requisition prints every test from one session on a single sheet by grouping
// on it. Deleting the consultation would leave those pointing at nothing, and
// nobody would notice until a requisition came out blank.

/** The status a cancelled consultation carries. Free text in the DB. */
export const CANCELLED = "cancelled";

/**
 * Everything that would make a consultation worth keeping.
 *
 * Deliberately a plain shape rather than the DB row: the caller does the
 * queries, this decides. That keeps the rule testable without a database, and
 * means the rule reads as one list rather than being spread across an `and`
 * chain in the middle of a server action.
 */
export type ConsultContent = {
  status: string;
  summary: string | null;
  aiSummary: string | null;
  /** [[question, answer], ...] — the questionnaire. */
  answers: unknown[] | null;
  /** Clinical flags raised during the session. */
  flags: unknown[] | null;
  /** Half-typed work the console autosaved. */
  draft: unknown | null;
  /** Rows elsewhere that point at this consultation. */
  orderCount: number;
  prescriptionCount: number;
};

export type DeletableVerdict =
  | { deletable: true }
  | { deletable: false; reason: string };

const hasText = (s: string | null) => Boolean(s && s.trim());
const hasRows = (a: unknown[] | null) => Array.isArray(a) && a.length > 0;

/**
 * May this consultation be destroyed outright?
 *
 * Returns the REASON when it may not, because "Delete" silently doing nothing
 * is worse than no Delete button at all — the clinician needs to be told that
 * cancelling is the route, and why.
 */
export function deletable(c: ConsultContent): DeletableVerdict {
  // A completed consultation is an encounter that happened. Even with every
  // field blank, the record that it took place is clinical history.
  if (c.status === "completed") return { deletable: false, reason: "it has been completed" };
  if (hasText(c.summary)) return { deletable: false, reason: "a summary has been written" };
  if (hasText(c.aiSummary)) return { deletable: false, reason: "an AI draft summary exists" };
  if (hasRows(c.answers)) return { deletable: false, reason: "questionnaire answers have been recorded" };
  if (hasRows(c.flags)) return { deletable: false, reason: "clinical flags were raised" };
  if (c.draft != null) return { deletable: false, reason: "unsaved console work was autosaved to it" };
  if (c.orderCount > 0) {
    return { deletable: false, reason: `${c.orderCount} lab order${c.orderCount === 1 ? "" : "s"} were placed in it` };
  }
  if (c.prescriptionCount > 0) {
    return { deletable: false, reason: `${c.prescriptionCount} prescription${c.prescriptionCount === 1 ? "" : "s"} were signed in it` };
  }
  return { deletable: true };
}

/**
 * What a cancelled consultation goes back to when somebody undoes it.
 *
 * `completed_at` is the tell: a consultation that had been completed before it
 * was cancelled returns to completed, and one that never got that far returns
 * to scheduled. Storing the previous status would be a column that can go
 * stale; deriving it can't.
 */
export function statusAfterUndo(completedAt: string | null): string {
  return completedAt ? "completed" : "scheduled";
}
