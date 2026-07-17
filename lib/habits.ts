// Habit streak helpers. A "streak" is the number of consecutive days (ending
// today or yesterday) the habit was marked done.

function addDays(iso: string, days: number) {
  // UTC math so the result is independent of the server's timezone
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Current streak given the set of done-dates (YYYY-MM-DD) and today's date. */
export function currentStreak(doneDates: Iterable<string>, today: string): number {
  const set = doneDates instanceof Set ? doneDates : new Set(doneDates);
  // allow the streak to be "alive" if today isn't logged yet but yesterday was
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** How many of the last 7 days (inclusive of today) were done. */
export function last7Count(doneDates: Iterable<string>, today: string): number {
  const set = doneDates instanceof Set ? doneDates : new Set(doneDates);
  let n = 0;
  for (let i = 0; i < 7; i++) if (set.has(addDays(today, -i))) n++;
  return n;
}
