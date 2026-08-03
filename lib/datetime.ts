// Clinic-local date/time formatting — ONE source of truth.
//
// Why this exists: timestamps are stored UTC, and every page here renders on the
// server, where Vercel's Node runtime is UTC. `instrumentation.ts` tries to set
// process.env.TZ, but `Intl` / `toLocaleString` caches the default timezone the
// first time it's used, so that fix is not dependable — a walk-in entered at
// 2:51 pm IST was displayed as "9:21 am" (its raw UTC time) on the CRM.
//
// The dependable fix is to name the timezone on every format call. Use these
// helpers instead of calling toLocale*() on a timestamp directly.
//
// NOTE: for DATE-ONLY columns (appointments.date, sessions.date — plain
// 'YYYY-MM-DD', no time), do NOT use these. Those are already clinic-local
// calendar dates; formatting them through a timezone can shift them a day. Keep
// pinning `timeZone: "UTC"` for those, as the existing code does.

export const IST = "Asia/Kolkata";

/** "3 Aug 2026" — from a timestamptz. */
export function fmtDate(iso: string | Date, locale = "en-IN"): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric", timeZone: IST,
  });
}

/** "2:51 pm" — from a timestamptz. */
export function fmtTime(iso: string | Date, locale = "en-IN"): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST,
  });
}

/** "3 Aug 2026, 2:51 pm" — from a timestamptz. */
export function fmtDateTime(iso: string | Date, locale = "en-IN"): string {
  return `${fmtDate(iso, locale)}, ${fmtTime(iso, locale)}`;
}

/** "03 Aug, 14:51" — compact 24h, for dense tables (audit, alerts, threads). */
export function fmtShort(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: IST,
  });
}
