// The turnaround clock, with no knowledge of any particular protocol.
//
// Extracted from lib/blueprint-sla.ts when the Comprehensive protocol became
// the second caller. BluePrint and Comprehensive measure very different things
// — BluePrint is turnaround from an event, Comprehensive is adherence to a
// day-offset calendar — but both need the same three primitives: a deadline, a
// pause that banks elapsed time, and a status that distinguishes "late" from
// "still running".

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Warn once a quarter of the window is left. Proportional so a 24h and a
 *  28-day deadline both feel the same. */
export const WARN_FRACTION = 0.25;

export type SlaStatus =
  | "waiting"    // the triggering event hasn't happened; no clock yet
  | "running"    // clock going, comfortably inside the window
  | "due_soon"   // inside WARN_FRACTION of the deadline
  | "breached"   // past the deadline and still not done
  | "met"        // done inside the window
  | "late";      // done, but after the deadline

export type Clock = {
  status: SlaStatus;
  /** null while `waiting` */
  dueAt: string | null;
  /** ms remaining; negative once past due. null while `waiting`. */
  msLeft: number | null;
  /** true for breached | late — the commitment was actually missed */
  missed: boolean;
};

/** An open pause (`holdSince`) plus time banked from previously closed ones. */
export type Hold = { holdSince: string | null; holdMs: number };
export const NO_HOLD: Hold = { holdSince: null, holdMs: 0 };

export const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

/** Total paused time to discount as of `now` — banked plus any open hold. */
export function heldMs(hold: Hold, now: number): number {
  const open = ms(hold.holdSince);
  const live = open != null ? Math.max(0, now - open) : 0;
  return Math.max(0, hold.holdMs) + live;
}

/**
 * One clock.
 *
 * Hold time extends the deadline rather than freezing the countdown, so
 * `dueAt` stays a real timestamp someone can read off a screen. Only hold time
 * accrued *before* the work was finished is discounted — a hold opened after
 * delivery cannot retroactively make a late deliverable on time.
 */
export function clock(
  startedAt: string | null | undefined,
  doneAt: string | null | undefined,
  windowMs: number,
  now: number,
  hold: Hold = NO_HOLD,
): Clock {
  const start = ms(startedAt);
  if (start == null) return { status: "waiting", dueAt: null, msLeft: null, missed: false };

  const done = ms(doneAt);
  const paused = done != null
    ? Math.min(heldMs(hold, done), Math.max(0, done - start))
    : heldMs(hold, now);

  const dueMs = start + windowMs + paused;
  const dueAt = new Date(dueMs).toISOString();

  if (done != null) {
    const missed = done > dueMs;
    return { status: missed ? "late" : "met", dueAt, msLeft: dueMs - done, missed };
  }

  const msLeft = dueMs - now;
  if (msLeft < 0) return { status: "breached", dueAt, msLeft, missed: true };
  if (msLeft <= windowMs * WARN_FRACTION) return { status: "due_soon", dueAt, msLeft, missed: false };
  return { status: "running", dueAt, msLeft, missed: false };
}

/**
 * A clock against a fixed calendar date rather than an elapsed window — the
 * shape the Comprehensive day-offset milestones need. `dueDate` is a date-only
 * ISO string; the deadline is the end of that day.
 */
export function dateClock(
  dueDate: string | null | undefined,
  doneAt: string | null | undefined,
  now: number,
  hold: Hold = NO_HOLD,
): Clock {
  if (!dueDate) return { status: "waiting", dueAt: null, msLeft: null, missed: false };
  const base = Date.parse(`${dueDate}T23:59:59Z`);
  if (!Number.isFinite(base)) return { status: "waiting", dueAt: null, msLeft: null, missed: false };

  const done = ms(doneAt);
  const paused = done != null ? heldMs(hold, done) : heldMs(hold, now);
  const dueMs = base + paused;
  const dueAt = new Date(dueMs).toISOString();

  if (done != null) {
    const missed = done > dueMs;
    return { status: missed ? "late" : "met", dueAt, msLeft: dueMs - done, missed };
  }
  const msLeft = dueMs - now;
  if (msLeft < 0) return { status: "breached", dueAt, msLeft, missed: true };
  // A calendar milestone has no natural window to take a quarter of, so warn
  // inside two days — enough time to actually get someone booked.
  if (msLeft <= 2 * DAY) return { status: "due_soon", dueAt, msLeft, missed: false };
  return { status: "running", dueAt, msLeft, missed: false };
}

/** "4h left", "2d overdue", "—". Coarse on purpose: minutes are false
 *  precision on a 24-hour, let alone a 28-day, commitment. */
export function formatLeft(msLeft: number | null): string {
  if (msLeft == null) return "—";
  const over = msLeft < 0;
  const abs = Math.abs(msLeft);
  const h = abs / HOUR;
  const txt = h < 1 ? `${Math.max(1, Math.round(abs / 60000))}m`
    : h < 48 ? `${Math.round(h)}h`
    : `${Math.round(h / 24)}d`;
  return over ? `${txt} overdue` : `${txt} left`;
}

export const SLA_TONE: Record<SlaStatus, { bg: string; color: string; label: string }> = {
  waiting:  { bg: "var(--neutral-bg)", color: "var(--muted)",      label: "Not started" },
  running:  { bg: "var(--blue-bg)",    color: "var(--blue-text)",  label: "On track" },
  due_soon: { bg: "var(--amber-bg)",   color: "var(--amber-text)", label: "Due soon" },
  breached: { bg: "var(--red-bg)",     color: "var(--red-text)",   label: "Overdue" },
  met:      { bg: "var(--green-bg)",   color: "var(--green-text)", label: "On time" },
  late:     { bg: "var(--amber-bg)",   color: "var(--amber-text)", label: "Late" },
};
