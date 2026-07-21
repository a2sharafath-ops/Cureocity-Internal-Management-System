// BluePrint delivery SLA — the clocks, as pure functions.
//
// Two commitments:
//   • each clinician approves their own summary within 24h of their
//     appointment completing;
//   • the consolidated summary and blueprint approval land within 48h of the
//     LAST of the three appointments completing.
//
// The 48h clock starts at the last appointment rather than the first because
// the consolidated summary literally cannot be written until all three have
// happened. Starting it earlier would produce deadlines that were already
// impossible when they were set, which teaches people to ignore the number.
//
// Clocks are wall clock, 24/7 — an appointment finishing Friday 7pm is due
// Saturday 7pm. Simple to explain and to verify. The escape hatch for nights,
// weekends and unreachable clients is the explicit hold, not a calendar.

export const HOUR = 3_600_000;
export const SIGNOFF_MS = 24 * HOUR;
export const CONSOLIDATED_MS = 48 * HOUR;

/** Warn once a quarter of the window is left — 6h on the 24h clock, 12h on
 *  the 48h. Proportional rather than fixed so both feel the same. */
export const WARN_FRACTION = 0.25;

/** The three disciplines whose sign-off gates the consolidated summary.
 *  Matches `consultations.kind`. Coach and Psychologist consults happen but
 *  are not part of the BluePrint delivery commitment. */
export const SLA_KINDS = ["Doctor", "Diet", "Trainer"] as const;
export type SlaKind = (typeof SLA_KINDS)[number];

export type SlaStatus =
  | "waiting"    // the appointment hasn't happened; no clock yet
  | "running"    // clock going, comfortably inside the window
  | "due_soon"   // inside WARN_FRACTION of the deadline
  | "breached"   // past the deadline and still not done
  | "met"        // done inside the window
  | "late";      // done, but after the deadline — kept distinct from `met`

export type Clock = {
  status: SlaStatus;
  /** null while `waiting` */
  dueAt: string | null;
  /** ms remaining; negative once past due. null while `waiting`. */
  msLeft: number | null;
  /** true for breached | late — i.e. the commitment was actually missed */
  missed: boolean;
};

export type Hold = { holdSince: string | null; holdMs: number };

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * Total paused time to discount, as of `now`. Banked holds plus any hold
 * that's still open. Mirrors totalFrozenDays() in package-window.ts.
 */
export function heldMs(hold: Hold, now: number): number {
  const open = ms(hold.holdSince);
  const live = open != null ? Math.max(0, now - open) : 0;
  return Math.max(0, hold.holdMs) + live;
}

/**
 * One clock.
 *
 * `startedAt` null  -> waiting (the triggering event hasn't happened)
 * `doneAt` set      -> met or late, measured against the deadline as it stood
 *                      when the work was finished
 * otherwise         -> running / due_soon / breached against `now`
 *
 * Hold time extends the deadline rather than freezing the countdown, which
 * keeps `dueAt` a real timestamp someone can read off a screen.
 */
export function clock(
  startedAt: string | null | undefined,
  doneAt: string | null | undefined,
  windowMs: number,
  now: number,
  hold: Hold = { holdSince: null, holdMs: 0 },
): Clock {
  const start = ms(startedAt);
  if (start == null) {
    return { status: "waiting", dueAt: null, msLeft: null, missed: false };
  }

  const done = ms(doneAt);
  // Only discount hold time accrued before the work was finished — a hold
  // opened after delivery can't retroactively make a late blueprint on time.
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
  if (msLeft <= windowMs * WARN_FRACTION) {
    return { status: "due_soon", dueAt, msLeft, missed: false };
  }
  return { status: "running", dueAt, msLeft, missed: false };
}

// ---------------------------------------------------------------------------

export type ConsultInput = {
  kind: string;
  completedAt: string | null;
  approvedAt: string | null;
};

export type SlaInput = {
  consults: ConsultInput[];
  /** blueprints.consolidated_at — the consolidated summary being written */
  consolidatedAt: string | null;
  /** blueprints.approved_at — the final gate */
  approvedAt: string | null;
  hold?: Hold;
};

export type SlaReport = {
  /** one clock per SLA discipline, in SLA_KINDS order */
  signoffs: { kind: SlaKind; clock: Clock }[];
  /** the 48h clock covering consolidated summary + blueprint approval */
  consolidated: Clock;
  /** when the last of the three appointments completed; null until all three */
  lastCompletedAt: string | null;
  /** anything breached or delivered late right now */
  missed: boolean;
  /** anything breached or due_soon — i.e. needs a human today */
  needsAttention: boolean;
  onHold: boolean;
};

/**
 * The whole picture for one client.
 *
 * A discipline with several consultations uses its most recent completed one:
 * a follow-up consult restarts that discipline's clock, which is the intent —
 * the sign-off owed is for the latest piece of work, not the first.
 */
export function blueprintSla(input: SlaInput, now: number = Date.now()): SlaReport {
  const hold: Hold = input.hold ?? { holdSince: null, holdMs: 0 };

  const latest = (kind: SlaKind): ConsultInput | null => {
    const rows = input.consults
      .filter((c) => c.kind === kind && c.completedAt)
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    return rows[0] ?? null;
  };

  const signoffs = SLA_KINDS.map((kind) => {
    const c = latest(kind);
    return {
      kind,
      clock: clock(c?.completedAt ?? null, c?.approvedAt ?? null, SIGNOFF_MS, now, hold),
    };
  });

  // The 48h clock only starts once every discipline has a completed
  // appointment. Missing one leaves lastCompletedAt null and the clock waiting.
  const completions = SLA_KINDS.map((k) => latest(k)?.completedAt ?? null);
  const lastCompletedAt = completions.every(Boolean)
    ? completions.slice().sort().reverse()[0]
    : null;

  // Delivery is only done when both halves are: summary written AND approved.
  // Approval is the meaningful one, so an approved-but-unrecorded-summary row
  // still counts as delivered.
  const deliveredAt = input.approvedAt
    ? (input.consolidatedAt && input.consolidatedAt > input.approvedAt
        ? input.consolidatedAt
        : input.approvedAt)
    : null;

  const consolidated = clock(lastCompletedAt, deliveredAt, CONSOLIDATED_MS, now, hold);

  const all = [...signoffs.map((s) => s.clock), consolidated];
  return {
    signoffs,
    consolidated,
    lastCompletedAt,
    missed: all.some((c) => c.missed),
    needsAttention: all.some((c) => c.status === "breached" || c.status === "due_soon"),
    onHold: Boolean(hold.holdSince),
  };
}

// ---- presentation helpers --------------------------------------------------

/** "4h left", "2h overdue", "—". Deliberately coarse: minutes create false
 *  precision on a 24-hour commitment. */
export function formatLeft(msLeft: number | null): string {
  if (msLeft == null) return "—";
  const over = msLeft < 0;
  const h = Math.abs(msLeft) / HOUR;
  const txt = h < 1
    ? `${Math.max(1, Math.round(Math.abs(msLeft) / 60000))}m`
    : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
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

export const KIND_LABEL: Record<SlaKind, string> = {
  Doctor: "Doctor", Diet: "Dietitian", Trainer: "Trainer",
};

/** The three appointments front desk must get into the diary once BluePrint is
 *  sold. Titles are matched on to avoid duplicating tasks, so don't reword
 *  `label` without a data migration. */
export const BP_BOOKING_TASKS = [
  { kind: "Doctor" as const,  label: "Book BluePrint doctor consultation" },
  { kind: "Diet" as const,    label: "Book BluePrint dietitian consultation" },
  { kind: "Trainer" as const, label: "Book BluePrint trainer assessment" },
];

/** How long front desk has to get those three booked. Not an SLA the clinical
 *  clocks depend on — those only start once an appointment completes — but it
 *  stops a sold BluePrint sitting untouched. */
export const BP_BOOKING_DUE_DAYS = 2;
