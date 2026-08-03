// Real "today" helpers — replaces the old frozen demo date.
//
// These MUST be clinic-local (IST), not server-local. Every page renders on
// Vercel's Node runtime, which is UTC, and instrumentation.ts's process.env.TZ
// assignment is not dependable (Intl caches the default zone on first use). With
// a UTC "today" the whole clinic day is wrong between 00:00 and 05:29 IST:
// "today's appointments" would still show yesterday's, and anything booked for
// today would read as overdue. So the zone is named explicitly here.

import { IST } from "@/lib/datetime";

/** Clinic-local calendar date as YYYY-MM-DD. */
export function todayISO(): string {
  // en-CA formats as ISO-shaped YYYY-MM-DD, so no manual offset maths.
  return new Date().toLocaleDateString("en-CA", { timeZone: IST });
}

export function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST,
  });
}
