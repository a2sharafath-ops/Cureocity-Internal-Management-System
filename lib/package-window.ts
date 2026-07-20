// Package start/end dates, with freeze handling.
//
// A paused package must not burn validity. `freeze_days` banks time from
// pauses that have finished; an open pause (`frozen` set) is counted live so
// the end date stays right mid-pause without a nightly job ticking it along.

export type FreezeState = {
  /** package start (client.joined, or client_packages.start_date) */
  start: string | null;
  /** validity in days from the package definition */
  validity: number | null;
  /** date the current pause began; null when running */
  frozen: string | null;
  /** days banked from previous, completed pauses */
  freezeDays: number;
};

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const n = (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000;
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Total days the package has been on hold, including any pause still open. */
export function totalFrozenDays(s: FreezeState, today: string): number {
  const open = s.frozen ? daysBetween(s.frozen, today) : 0;
  return Math.max(0, s.freezeDays) + open;
}

export type PackageWindow = {
  start: string | null;
  end: string | null;
  /** days added by freezing, so the UI can explain a shifted end date */
  extendedBy: number;
  /** whole days left; negative once expired. Null if we can't compute it. */
  daysLeft: number | null;
  expired: boolean;
  paused: boolean;
  /** how long the current pause has been running */
  pausedFor: number;
};

export function packageWindow(s: FreezeState, today: string): PackageWindow {
  const extendedBy = totalFrozenDays(s, today);
  const paused = Boolean(s.frozen);
  const pausedFor = s.frozen ? daysBetween(s.frozen, today) : 0;

  if (!s.start || s.validity == null) {
    return { start: s.start, end: null, extendedBy, daysLeft: null, expired: false, paused, pausedFor };
  }

  // Displayed end date includes the pause still running, so it slides out by a
  // day for every day on hold.
  const end = addDays(s.start, s.validity + extendedBy);

  // The remaining balance, though, is fixed the moment you pause: measure from
  // the freeze date to the end date as it stood *then* (banked days only).
  // Using `end` here would grow days-left by one for every day paused.
  const reference = s.frozen ?? today;
  const balanceEnd = addDays(s.start, s.validity + Math.max(0, s.freezeDays));
  const daysLeft = reference > balanceEnd
    ? -daysBetween(balanceEnd, reference)
    : daysBetween(reference, balanceEnd);

  return {
    start: s.start,
    end,
    extendedBy,
    daysLeft,
    expired: !paused && today > end,
    paused,
    pausedFor,
  };
}

/** BluePrint journey, as five ordered gates. */
export type BpStep = { key: string; label: string; done: boolean };

export function blueprintSteps(input: {
  bloodRequested: boolean;
  bloodSubmitted: boolean;
  doctor: boolean;
  diet: boolean;
  trainer: boolean;
  generated: boolean;
}): BpStep[] {
  return [
    { key: "requested", label: "Blood requested", done: input.bloodRequested },
    { key: "submitted", label: "Report in", done: input.bloodSubmitted },
    { key: "consults", label: "3 sign-offs", done: input.doctor && input.diet && input.trainer },
    { key: "scored", label: "Scored", done: input.generated },
    { key: "shared", label: "Delivered", done: input.generated },
  ];
}

export function blueprintProgress(steps: BpStep[]): { done: number; total: number; pct: number; next: string | null } {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done)?.label ?? null;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100), next };
}
