// Front-desk follow-up protocol. Onboarding touchpoints at fixed day-offsets
// from a client's join date, plus a renewal nudge 7 days before a subscription
// renews. Pure row builder shared by the server action and the daily cron.

export const ONBOARDING_OFFSETS = [2, 10, 21, 28];
export const RENEWAL_LEAD_DAYS = 7;

function addDaysUTC(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Which clients get the onboarding protocol at all. It is the Comprehensive
 *  care plan — day 10 and 21 are diet follow-ups, day 28 is the doctor's
 *  month-end review — so a BluePrint client or a facility-only member should
 *  never have been queued for it. Before this filter every client got all
 *  four rows regardless of what they bought. */
export type ProtocolClient = { id: string; joined: string | null; category?: string | null };

export function onProtocol(c: ProtocolClient): boolean {
  return (c.category ?? "").toLowerCase() === "comprehensive";
}

export type FollowupRow = {
  client_id: string; kind: string; label: string; due_date: string;
  priority: string; created_by: string; category: string; day: number | null; mode: string; stage: string;
};

// Protocol day → discipline + label + default mode (mirrors the prototype care plan).
const DAY_PROTOCOL: Record<number, { category: string; label: string; mode: string }> = {
  // Day 2 is the diet chart explanation, per services.day_offset and the
  // Comprehensive protocol — not a fitness check-in. The old label was the one
  // place the two definitions disagreed.
  2:  { category: "Diet Consultation",   label: "Day 2 diet chart explanation", mode: "Offline" },
  10: { category: "Diet Consultation",   label: "Day 10 diet follow-up",   mode: "Online" },
  21: { category: "Diet Consultation",   label: "Day 21 diet review",      mode: "Offline" },
  28: { category: "Doctor Consultation", label: "Day 28 doctor follow-up", mode: "Offline" },
};

export function buildFollowupRows(
  clients: ProtocolClient[],
  subs: { client_id: string; renews_on: string | null }[],
  createdBy: string,
): FollowupRow[] {
  const rows: FollowupRow[] = [];
  for (const c of clients) {
    if (!c.joined) continue;
    if (!onProtocol(c)) continue;   // renewal rows below still apply to everyone
    for (const off of ONBOARDING_OFFSETS) {
      const p = DAY_PROTOCOL[off];
      rows.push({
        client_id: c.id, kind: "onboarding", label: p.label,
        due_date: addDaysUTC(c.joined, off), priority: off === 2 ? "mandatory" : "normal", created_by: createdBy,
        category: p.category, day: off, mode: p.mode, stage: "PENDING_CALL",
      });
    }
  }
  for (const s of subs) {
    if (!s.renews_on) continue;
    rows.push({
      client_id: s.client_id, kind: "renewal", label: `Renewal due (${s.renews_on})`,
      due_date: addDaysUTC(s.renews_on, -RENEWAL_LEAD_DAYS), priority: "mandatory", created_by: createdBy,
      category: "Renewal", day: null, mode: "Online", stage: "PENDING_CALL",
    });
  }
  return rows;
}

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
