// One activity stream for a person, newest first.
//
// The Salesforce insight worth copying: a rep opening a record shouldn't see a
// phone number and six separate tables sorted six different ways. They should
// see what happened, most recent first, whatever kind of thing it was.
//
// Today the client page has an "overview", a "timeline" tab that is actually a
// fixed onboarding checklist, and a "card" — with invoices sorted by date,
// sessions by sequence number, and consultations by creation, none of them
// merged. Emails, messages and tasks aren't shown at all.
//
// This file does the merging. It is deliberately a pure function over already-
// fetched rows rather than a new `activity` table: an events table would need
// every write path in the app to remember to append to it, and the one that
// forgets is the one that matters. Reading from the source tables can't drift.

export type TimelineKind =
  | "remark" | "call" | "email" | "message"
  | "appointment" | "session" | "consultation"
  | "invoice" | "payment" | "package"
  | "task" | "concern" | "note";

export type TimelineEvent = {
  /** ISO timestamp — the sort key. Date-only sources get noon so they land
   *  inside their day rather than at midnight, which reads as "yesterday". */
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string | null;
  by?: string | null;
  /** where clicking should go, when there's somewhere useful */
  href?: string | null;
  /** past tense done vs still scheduled — drives the muted styling */
  pending?: boolean;
};

/** Date-only values become midday so they sort inside their own day. */
/**
 * Normalise a date for the timeline: midday UTC, so a date-only column can't
 * drift across a day boundary when rendered in IST.
 *
 * It has to cope with BOTH shapes the app stores, and it didn't. Most columns
 * are date-only ("2026-08-07"), but a few are full timestamps
 * ("2026-08-07T04:41:15.218496+00:00"). Appending "T12:00:00Z" to a timestamp
 * produced "…+00:00T12:00:00Z", which Date.parse rejects — and buildTimeline
 * silently drops anything unparseable.
 *
 * The visible symptom: CONSULTATIONS never appeared on a client's Journey
 * timeline. `consultations.created_at` is a timestamp; packages, invoices,
 * prescriptions and blood requests are all date-only, so everything else showed
 * up and only the consultations were missing. Nothing errored, nothing logged.
 */
export const atDay = (d: string | null | undefined): string | null => {
  if (!d) return null;
  // Already a timestamp (has a time part) — take the calendar day from it.
  const day = d.length > 10 ? d.slice(0, 10) : d;
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T12:00:00Z` : null;
};

export const KIND_ICON: Record<TimelineKind, string> = {
  remark: "🗒", call: "📞", email: "✉️", message: "💬",
  appointment: "📅", session: "🏋", consultation: "🩺",
  invoice: "🧾", payment: "💰", package: "📦",
  task: "✅", concern: "⚠️", note: "📝",
};

export const KIND_LABEL: Record<TimelineKind, string> = {
  remark: "Remark", call: "Call", email: "Email", message: "Message",
  appointment: "Appointment", session: "Session", consultation: "Consultation",
  invoice: "Invoice", payment: "Payment", package: "Package",
  task: "Task", concern: "Concern", note: "Note",
};

/**
 * Merge and sort. Events with no usable timestamp are dropped rather than
 * bunched at the epoch — an undated row at the bottom of the list looks like
 * it happened in 1970, which is worse than not showing it.
 */
export function buildTimeline(groups: (TimelineEvent | null)[][]): TimelineEvent[] {
  const all: TimelineEvent[] = [];
  for (const g of groups) {
    for (const e of g) {
      if (!e || !e.at) continue;
      const t = Date.parse(e.at);
      if (!Number.isFinite(t)) continue;
      all.push(e);
    }
  }
  return all.sort((a, b) => b.at.localeCompare(a.at));
}

/** Group into "Today", "Yesterday", "This week", then month names. */
export function groupByPeriod(
  events: TimelineEvent[],
  todayISO: string,
): { label: string; events: TimelineEvent[] }[] {
  const out: { label: string; events: TimelineEvent[] }[] = [];
  const push = (label: string, e: TimelineEvent) => {
    const last = out[out.length - 1];
    if (last && last.label === label) last.events.push(e);
    else out.push({ label, events: [e] });
  };

  const today = Date.parse(`${todayISO}T00:00:00Z`);
  for (const e of events) {
    const day = Date.parse(`${e.at.slice(0, 10)}T00:00:00Z`);
    const diff = Math.round((today - day) / 86_400_000);
    if (diff <= 0) push("Today", e);
    else if (diff === 1) push("Yesterday", e);
    else if (diff <= 7) push("This week", e);
    else {
      push(new Date(e.at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }), e);
    }
  }
  return out;
}

/** "3 hours ago", "2 days ago". Coarse on purpose. */
export function ago(at: string, now: number = Date.now()): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return "";
  const mins = Math.round((now - t) / 60_000);
  if (mins < 0) return "scheduled";
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.round(months / 12)}y ago`;
}
