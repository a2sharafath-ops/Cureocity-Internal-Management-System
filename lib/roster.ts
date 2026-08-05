// Roster + comp-off helpers. Pure functions, so the week grid and the balance
// badge can be unit-tested without a database.

export type Shift = {
  code: string; name: string; start_time: string | null; end_time: string | null;
  color: string | null; working: boolean;
};
export type RosterRow = {
  staff_id: string; date: string; shift: string;
  start_time: string | null; end_time: string | null; note: string | null;
};
export type CompOff = {
  id: string; staff_id: string; earned_on: string; reason: string;
  expires_on: string; status: string;
};

/** Monday-first week containing `iso`, as seven ISO dates. */
export function weekDates(iso: string): string[] {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;              // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "07:00:00" → "7am", "14:30:00" → "2:30pm". Rosters are scanned, not read. */
export function shortTime(t: string | null): string {
  if (!t) return "";
  const [hRaw, m] = t.split(":");
  const h = Number(hRaw);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m && m !== "00" ? `${h12}:${m}${ampm}` : `${h12}${ampm}`;
}

/** The hours actually worked on a day — the override if set, else the shift's. */
export function shiftHours(row: RosterRow | undefined, shifts: Map<string, Shift>): string {
  if (!row) return "";
  const s = shifts.get(row.shift);
  if (!s?.working) return s?.name ?? "";
  const from = row.start_time ?? s.start_time;
  const to = row.end_time ?? s.end_time;
  return from && to ? `${shortTime(from)}–${shortTime(to)}` : (s?.name ?? "");
}

/** Did someone deviate from the template on this day? Worth showing. */
export function isOverridden(row: RosterRow | undefined, shifts: Map<string, Shift>): boolean {
  if (!row || (!row.start_time && !row.end_time)) return false;
  const s = shifts.get(row.shift);
  if (!s) return false;
  return (row.start_time ?? s.start_time) !== s.start_time
      || (row.end_time ?? s.end_time) !== s.end_time;
}

/**
 * Comp-off balance for one person.
 *
 * `expired` is computed against today rather than trusted from the row: the
 * nightly sweep may not have run, and a credit that lapsed this morning must
 * not still read as available on the leave form.
 */
export function compOffBalance(rows: CompOff[], today: string) {
  let available = 0, expiringSoon = 0, used = 0, expired = 0;
  for (const c of rows) {
    if (c.status === "used") { used++; continue; }
    if (c.status === "cancelled") continue;
    if (c.status === "expired" || c.expires_on < today) { expired++; continue; }
    available++;
    if (c.expires_on <= addDays(today, 14)) expiringSoon++;
  }
  return { available, expiringSoon, used, expired };
}

/** 90 days to use it, from the day that earned it. */
export const COMP_OFF_VALID_DAYS = 90;
export function compOffExpiry(earnedOn: string): string {
  return addDays(earnedOn, COMP_OFF_VALID_DAYS);
}
