// WHO OWNS WHAT — the single answer, for every engine.
//
// This file exists because the same obligation used to name different people
// depending on which screen you were on. The 12 strength sessions were the
// trainer's in the SLA engine and the front desk's in both attention queues.
// The day 10/21/28 milestones recorded a clinical owner in MILESTONES and then
// had it overwritten with "Front Desk" downstream. Nobody was wrong; there were
// simply three copies of the rule and they drifted.
//
// So the rule now lives here once and every engine reads it.
//
// ---- the two-owner idea ----------------------------------------------------
//
// Most client work has TWO owners, not one, and collapsing them is what caused
// the disagreement:
//
//   • the BOOKING owner — who gets it into the diary;
//   • the DELIVERY owner — the Health Professional who actually does it.
//
// A missed day-10 diet follow-up might be either person's fault: nobody booked
// it, or it was booked and not held. Naming only one of them makes half of
// those cases un-chaseable, so both are recorded and each engine picks the one
// that matches what it is complaining about.

import type { Role } from "@/lib/roles";

/** A role-wide chase target — used when no individual can be resolved. */
export type OwnerRoles = Role[];

// ---- booking ---------------------------------------------------------------

/**
 * Getting a client into the diary is the Health Coach's job.
 *
 * They own the client relationship for every package that has a care team, so
 * they are the one person who knows why a booking hasn't happened yet. Front
 * desk keeps the buttons — a client standing at the counter should never be
 * told to wait for the coach — but nothing chases front desk for a booking.
 */
export const BOOKING_OWNER: OwnerRoles = ["Health Coach"];

// ---- money and the front counter -------------------------------------------

/** Raising the invoice for a package that has been sold. */
export const INVOICE_RAISE_OWNER: OwnerRoles = ["Front Desk", "Finance"];

/** Chasing an invoice that has been raised and not paid. */
export const INVOICE_CHASE_OWNER: OwnerRoles = ["Front Desk", "Finance"];

/** A subscription coming up for renewal, and a package about to end. */
export const RENEWAL_OWNER: OwnerRoles = ["Front Desk"];

/** A walk-in has filled in the tablet and nobody has picked it up. */
export const INTAKE_OWNER: OwnerRoles = ["Front Desk"];

// ---- delivery, by discipline -----------------------------------------------

/**
 * The Health Professional role that DELIVERS each discipline's work. Used for
 * turnaround breaches (a chart not drafted, a plan not written) and for the
 * delivery half of a milestone.
 */
export const DELIVERY_OWNER: Record<string, OwnerRoles> = {
  doctor: ["Doctor"],
  dietitian: ["Dietitian"],
  trainer: ["Fitness Trainer"],
  coach: ["Health Coach"],
  psychologist: ["Psychologist"],
};

/**
 * The strength-session block.
 *
 * Trainer everywhere. It used to be trainer in the SLA engine and front desk in
 * the queues; the trainer is the one who runs the sessions, so the trainer is
 * who a shortfall belongs to. Getting the FIRST block into the diary is still a
 * booking, and so still the coach's — see `sessionOwners` below.
 */
export const SESSION_DELIVERY_OWNER: OwnerRoles = ["Fitness Trainer"];

/**
 * Nothing at all in the diary is a booking failure; falling behind on a block
 * that IS booked is a delivery failure. Both people need to hear about the
 * first case, because it is the one that silently costs the client a month.
 */
export function sessionOwners(anyBooked: boolean): OwnerRoles {
  return anyBooked ? SESSION_DELIVERY_OWNER : [...BOOKING_OWNER, ...SESSION_DELIVERY_OWNER];
}

// ---- relationship work ------------------------------------------------------

/** Chasing the client for a blood report they were asked to bring. */
export const BLOOD_CHASE_OWNER: OwnerRoles = ["Health Coach"];

/**
 * A concern raised against no discipline, or one this app doesn't recognise.
 *
 * It used to resolve to null and sit on the whiteboard as an orange alert that
 * nobody was asked to answer. The Health Coach owns the client relationship, so
 * an unaddressed concern is theirs by default — and the Medical Director is the
 * clinical backstop when it goes unanswered.
 */
export const UNOWNED_CONCERN_DISCIPLINE = "coach";
export const CONCERN_ESCALATION_OWNER: OwnerRoles = ["Medical Director"];

/**
 * How long an open concern may sit before it stops being the coach's alone.
 *
 * Time-based on purpose — no `escalated` column to set, forget to set, or leave
 * stale after the concern is resolved. A concern is escalated because it is
 * old, and it stops being escalated the moment somebody closes it.
 */
export const CONCERN_ESCALATION_DAYS = 3;

/**
 * How long a new client has before a never-assessed coach marker is chased.
 *
 * The six markers are baselined in the first sessions, not on the day the
 * package is sold. Without a grace window every new Comprehensive client would
 * arrive on the coach's queue with six red flags on day one, which trains
 * people to ignore the panel.
 */
export const MARKER_BASELINE_GRACE_DAYS = 7;

/** Working the follow-up queue itself. */
export const FOLLOWUP_QUEUE_OWNER: OwnerRoles = ["Front Desk"];

// ---- approval ---------------------------------------------------------------

/** Clinical sign-off on anything a client receives. */
export const APPROVAL_OWNER: OwnerRoles = ["Medical Director"];

// ---- money: what counts as settled ------------------------------------------

/**
 * Invoice statuses that are NOT outstanding.
 *
 * The client card treated Void / Cancelled / Refunded as done; the front-desk
 * dashboard only skipped "Paid". So an invoice raised for a package that was
 * later removed vanished from the client's card and nagged the front desk
 * forever, with a growing overdue count nobody could clear.
 *
 * Lives here rather than in either engine so there is one answer.
 */
export const SETTLED_INVOICE = new Set(["Paid", "Void", "Cancelled", "Refunded"]);
