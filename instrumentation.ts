// Runs once when a server instance boots (Next.js instrumentation hook).
//
// The Node runtime on Vercel defaults to UTC, so server-rendered dates and times
// — a lead's entry time, "today", etc. — show in UTC instead of local time.
// Vercel *reserves* the TZ environment variable, so we can't set it in the
// dashboard; instead we set the process timezone here. Node re-reads TZ on
// assignment, so this makes every subsequent Date render in India Standard Time.
// Date-only fields that explicitly pin `timeZone: "UTC"` are unaffected.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = process.env.TZ || "Asia/Kolkata";
  }
}
