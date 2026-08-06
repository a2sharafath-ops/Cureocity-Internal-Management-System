// Front-desk follow-up protocol — the CALL workflow over the care plan's
// milestones, plus a renewal nudge before a subscription renews.
//
// These rows used to be generated independently, from `clients.joined` and a
// private DAY_PROTOCOL table. lib/comprehensive.ts holds the same four
// touchpoints, dated from the package start, and declares itself the source of
// truth — so a client who joined in March and bought in June had "Day 10 diet
// follow-up" due on two different dates in two different queues, each closable
// without the other. The milestone list is now the only definition; this file
// turns it into calls to make.

import { MILESTONES, milestoneDates, cyclesFor } from "@/lib/comprehensive";
import { milestoneDates as ptMilestoneDates, cyclesFor as ptCyclesFor } from "@/lib/pt";

export const RENEWAL_LEAD_DAYS = 7;
/** Kept for the Day-2 explanation, which is a call, not a milestone. */
export const EXPLANATION_OFFSET = 2;

function addDaysUTC(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Which clients get the onboarding protocol at all — the Comprehensive care
 *  plan. A BluePrint client or facility-only member should never be queued. */
export type ProtocolClient = {
  id: string;
  joined: string | null;
  category?: string | null;
  /** package start — the milestone anchor. Falls back to `joined`. */
  start?: string | null;
  /** package length in days, for multi-cycle plans. */
  days?: number | null;
};

/**
 * Which packages have a follow-up ladder.
 *
 * PT was excluded, so a training client's fitness reassessment — a real
 * milestone with a real day-28 deadline in lib/pt.ts — never entered the queue
 * or either attention panel. It existed in the protocol definition and nowhere
 * a human would ever see it.
 */
export function onProtocol(c: ProtocolClient): boolean {
  const cat = (c.category ?? "").toLowerCase();
  return cat === "comprehensive" || cat === "training";
}

const isPt = (c: ProtocolClient) => (c.category ?? "").toLowerCase() === "training";

/** The date a client's protocol clock starts. The package start is what every
 *  milestone engine uses; `joined` is only a fallback for older rows that never
 *  recorded one. */
export function protocolStart(c: ProtocolClient): string | null {
  return c.start ?? c.joined ?? null;
}

export type FollowupRow = {
  client_id: string; kind: string; label: string; due_date: string;
  priority: string; created_by: string; category: string; day: number | null;
  mode: string; stage: string; milestone_key: string;
};

const OWNER_CATEGORY: Record<string, string> = {
  dietitian: "Diet Consultation",
  doctor: "Doctor Consultation",
  trainer: "Fitness Services",
  coach: "Coaching",
};

export function buildFollowupRows(
  clients: ProtocolClient[],
  subs: { client_id: string; renews_on: string | null }[],
  createdBy: string,
): FollowupRow[] {
  const rows: FollowupRow[] = [];
  for (const c of clients) {
    if (!onProtocol(c)) continue;              // renewal rows below apply to everyone
    const start = protocolStart(c);
    if (!start) continue;

    // Day 2 — explaining the diet chart. Comprehensive only: a PT client has
    // no dietitian and no chart to explain.
    if (!isPt(c)) rows.push({
      client_id: c.id, kind: "onboarding", label: "Day 2 diet chart explanation",
      due_date: addDaysUTC(start, EXPLANATION_OFFSET), priority: "mandatory", created_by: createdBy,
      category: "Diet Consultation", day: EXPLANATION_OFFSET, mode: "Offline",
      stage: "PENDING_CALL", milestone_key: "explain_2",
    });

    // Everything else comes straight off the care plan, so the call and the
    // booking gate can never be due on different days again.
    // PT has its own single milestone (the day-28 fitness reassessment);
    // Comprehensive has four. Same shape, so the row builder below is shared.
    const dated = isPt(c)
      ? ptMilestoneDates(start, ptCyclesFor(c.days ?? null))
      : milestoneDates(start, cyclesFor(c.days ?? null));
    for (const m of dated) {
      rows.push({
        client_id: c.id, kind: "onboarding", label: m.label,
        due_date: m.dueDate, priority: "normal", created_by: createdBy,
        category: OWNER_CATEGORY[m.owner] ?? "Consultation",
        day: m.due, mode: m.owner === "dietitian" && m.key === "diet_10" ? "Online" : "Offline",
        stage: "PENDING_CALL", milestone_key: m.gate,
      });
    }
  }

  for (const s of subs) {
    if (!s.renews_on) continue;
    // One renewal row per client, updated as the cycle advances. Keying on the
    // date meant every renewal minted a new row and orphaned the old one, which
    // then sat "to call" forever and inflated every overdue counter.
    rows.push({
      client_id: s.client_id, kind: "renewal", label: `Renewal due (${s.renews_on})`,
      due_date: addDaysUTC(s.renews_on, -RENEWAL_LEAD_DAYS), priority: "mandatory", created_by: createdBy,
      category: "Renewal", day: null, mode: "Online", stage: "PENDING_CALL",
      milestone_key: "renewal",
    });
  }
  return rows;
}

/** Milestone keys the generator can produce, for the backfill and for tests. */
export const FOLLOWUP_KEYS = ["explain_2", ...MILESTONES.map((m) => m.key), "renewal"];

// ---------------------------------------------------------------------------
// Follow-up ⟷ appointment reconciliation.
//
// The follow-ups queue and the milestone boards were two parallel worlds: the
// queue chased "Day 10 diet follow-up" while the boards chased "book day 10
// diet follow-up", and closing one left the other open forever. Front desk
// booking on the calendar left a permanently-overdue queue row (which the
// whiteboard then demanded an explanation for); the coach booking from the
// queue created a `Follow-up` appointment that no milestone could ever match.
//
// These two helpers are the single definition of "this appointment IS that
// follow-up", used by both paths so they cannot disagree again.
// ---------------------------------------------------------------------------

/** Appointment categories that close a follow-up of a given category. */
const FU_CATEGORY_MATCH: { test: RegExp; types: RegExp }[] = [
  { test: /diet chart explanation/i, types: /diet chart explanation/i },
  { test: /diet/i,                   types: /diet/i },
  { test: /doctor/i,                 types: /doctor/i },
  { test: /fitness|trainer|reassess/i, types: /fitness|training|assessment/i },
  { test: /coach/i,                  types: /coach/i },
  { test: /psych|counsel/i,          types: /psych|counsel/i },
];

/**
 * Does booking an appointment of `apptType` satisfy this follow-up?
 *
 * Matched on discipline, not on the exact label: a Day-10 diet follow-up is
 * done by a diet appointment whatever the front desk calls it.
 */
export function followupMatchesAppointment(
  fu: { label: string | null; category: string | null },
  apptType: string | null,
): boolean {
  const type = String(apptType ?? "").trim();
  if (!type) return false;
  const hay = `${fu.category ?? ""} ${fu.label ?? ""}`;
  for (const rule of FU_CATEGORY_MATCH) {
    if (rule.test.test(hay)) return rule.types.test(type);
  }
  return false;
}

/**
 * The appointment type to book for a follow-up.
 *
 * Previously everything except the Day-2 explanation booked as "Follow-up",
 * which is not a catalogue service — so `milestoneSatisfied` could never match
 * it and the milestone stayed open even though the visit was in the diary.
 * Booking the owning discipline's real service type is what closes both.
 */
export function apptTypeForFollowup(fu: { label: string | null; category: string | null }): string {
  const hay = `${fu.category ?? ""} ${fu.label ?? ""}`;
  if (/diet chart explanation/i.test(hay)) return "Diet Chart Explanation";
  if (/diet/i.test(hay)) return "Diet Consultation";
  if (/doctor/i.test(hay)) return "Doctor Consultation";
  if (/fitness|trainer|reassess/i.test(hay)) return "Fitness Services";
  if (/psych|counsel/i.test(hay)) return "Counselling";
  if (/coach/i.test(hay)) return "Coaching";
  return "Follow-up";                       // renewals and ad-hoc rows
}
