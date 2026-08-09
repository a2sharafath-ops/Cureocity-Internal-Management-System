// Shared building blocks for the "what a client owes" engines
// (lib/package-status.ts, lib/care-attention.ts, lib/frontdesk-attention.ts).
//
// Phase A of the obligations refactor (docs/obligations-refactor-plan.md): pull
// the logic that was copy-pasted across those engines into one place so they
// can't drift. No behaviour change — callers get the same results, from one
// implementation.

import { makeCatOf, serviceForMilestone, milestoneSatisfied, milestoneBookHref } from "@/lib/appt-match";

// Provider staff role → care-team discipline key.
export const ROLE_TO_DISC: Record<string, string> = {
  Doctor: "doctor",
  Dietitian: "dietitian",
  "Fitness Trainer": "trainer",
  "Health Coach": "coach",
  Psychologist: "psychologist",
};

export type Owner = { id: string; name: string };

export type AssignRow = { client_id: string; discipline: string; staff_id: string | null; staff: { name: string } | null };
export type ApptOwnerRow = { client_id: string; status: string; provider_id: string | null; staff: { name: string; role: string } | null };

// Resolve who owns each (client, discipline) deliverable: the explicit care-team
// assignment is the source of truth; failing that, the clinician who actually
// ran the completed consult (the appointment provider) — so a "Remind …" still
// targets a real person instead of degrading to a plain link.
//
// Works clinic-wide or for a single client; pass whatever assignment /
// appointment rows you already loaded. Returns a lookup `(clientId, disc)`.
export function buildOwnerResolver(
  assignments: AssignRow[],
  appts: ApptOwnerRow[],
): (clientId: string, discipline: string) => Owner | undefined {
  const assigned = new Map<string, Owner>();
  for (const a of assignments) {
    if (a.staff_id) assigned.set(`${a.client_id}|${a.discipline}`, { id: a.staff_id, name: a.staff?.name ?? "Health Professional" });
  }
  const fallback = new Map<string, Owner>();
  for (const a of appts) {
    if (a.status !== "completed" || !a.provider_id || !a.staff) continue;
    const disc = ROLE_TO_DISC[a.staff.role];
    if (!disc) continue;
    const key = `${a.client_id}|${disc}`;
    if (!fallback.has(key)) fallback.set(key, { id: a.provider_id, name: a.staff.name });
  }
  return (clientId, discipline) => assigned.get(`${clientId}|${discipline}`) ?? fallback.get(`${clientId}|${discipline}`);
}

// The clinician deliverables the onboarding ladder doesn't track: the
// comprehensive blood report, the diet chart, and the workout plan. Pure
// detection only — each caller maps these keys to its own label / owner / link.
//   • compblood — Comprehensive client with a comprehensive blood row that
//     hasn't been submitted (null = no row on file yet → not outstanding here).
//   • dietchart — Comprehensive client whose diet consult is done but no chart.
//   • workout   — Comprehensive OR PT client whose fitness assessment is done
//     but no workout plan exists.
// ---- calendar milestones ----------------------------------------------------
// The comprehensive/PT milestone loop (resolve each milestone's service, then
// check whether a booking already satisfies it) was copy-pasted across
// package-status, care-attention and today-agenda. This centralises the
// satisfied-check + pre-filled Book link; callers still decide WHICH milestones
// to surface (overdue / upcoming / due-today) and how to render them.
// `owner` is the DELIVERING discipline — the Health Professional who actually
// holds the appointment. It used to be dropped here, which is how the attention
// queues ended up inventing "Front Desk" as the owner of every milestone while
// the SLA engine chased the clinician: the field recording the answer never
// reached the code that needed it.
export type MilestoneLike = { apptType: string; from: number; fromDate: string; dueDate: string; label: string; gate: string; owner: string };
export type ServiceRow = { name: string; category: string; day_offset: number | null };
export type ApptMatchRow = { type: string | null; date: string | null; status: string };

export function unsatisfiedMilestones(
  clientId: string,
  dated: MilestoneLike[],
  appts: ApptMatchRow[],
  services: ServiceRow[],
  today: string,
): (MilestoneLike & { bookHref: string })[] {
  const catOf = makeCatOf(services);
  const out: (MilestoneLike & { bookHref: string })[] = [];
  for (const m of dated) {
    const svc = serviceForMilestone(m.apptType, m.from, services);
    // The upper bound of this milestone's window: the same milestone one cycle
    // later. On comp12 the day-10 diet follow-up recurs at day 38 and 66 under
    // an identical service name, so without this a single booking satisfied all
    // three. `dated` is the full milestone list, so the next occurrence is just
    // the next entry with the same appointment type and day offset.
    const next = dated.find((o) => o.apptType === m.apptType && o.from === m.from && o.fromDate > m.fromDate);
    if (milestoneSatisfied(appts, {
      category: m.apptType, fromDate: m.fromDate, toDate: next?.fromDate ?? null,
      service: svc, catOf, today,
    })) continue;
    out.push({ ...m, bookHref: milestoneBookHref(clientId, m.apptType, m.from, services) });
  }
  return out;
}

export type DeliverableKey = "compblood" | "dietchart" | "workout";

// ---- did the consult actually happen? --------------------------------------
//
// There were two answers to this, and they disagreed in a way that lost work
// silently.
//
// lib/client-status.ts counted a COMPLETED APPOINTMENT with a provider in that
// discipline as the consult being done — reasonable, because Front Desk marking
// the diary is how a held session most often gets recorded. The deliverable
// engine below counted only a `consultations` row with status "completed".
//
// So: the dietitian sees the client, Front Desk marks the appointment completed
// from the calendar, and no `consultations` row is ever written. The client card
// says the diet consultation is done and drops the booking step — while the
// diet chart never becomes outstanding, because THIS engine still thinks the
// consult hasn't happened. The 24-hour turnaround clock never starts either, so
// no breach fires. The client never receives a plan and no screen in the app
// says anything is missing.
//
// One definition now, used by both. It is deliberately the generous one: a
// consult that happened without paperwork is still a consult, and the cost of
// being wrong is a chart nobody needed rather than a client with no plan.

/** Consultation kinds, as stored on `consultations.kind`. */
const KIND_OF_ROLE: Record<string, string> = {
  "Doctor": "Doctor",
  "Dietitian": "Diet",
  "Fitness Trainer": "Trainer",
  "Health Coach": "Coach",
  "Psychologist": "Psychologist",
};

/** Appointment CATEGORY → the consultation kind it represents. */
const KIND_OF_CATEGORY: Record<string, string> = {
  "Doctor Consultation": "Doctor",
  "Diet Consultation": "Diet",
  "Fitness Services": "Trainer",
  "Coaching": "Coach",
  "Counselling": "Psychologist",
};

export type DoneConsultRow = { kind: string; status: string };
export type DoneApptRow = {
  type: string | null;
  status: string;
  /** The provider's staff role, where the appointment names one. */
  staff?: { role?: string | null } | null;
};

/**
 * Which consultation kinds are complete for a client.
 *
 * `catOf` resolves an appointment's `type` (which may be a specific service
 * name like "Initial Diet Consultation") to its category. Without it only exact
 * category names match, which is the safe degradation rather than a wrong one.
 */
export function consultDoneKinds(
  consults: DoneConsultRow[],
  appts: DoneApptRow[] = [],
  catOf?: (type: string | null) => string | null,
): Set<string> {
  const done = new Set<string>();
  for (const c of consults) if (c.status === "completed") done.add(c.kind);
  for (const a of appts) {
    if (a.status !== "completed") continue;
    // The provider's role is the stronger signal: it says who was in the room.
    const byRole = KIND_OF_ROLE[String(a.staff?.role ?? "")];
    if (byRole) { done.add(byRole); continue; }
    const category = catOf ? catOf(a.type) : a.type;
    const byCategory = KIND_OF_CATEGORY[String(category ?? "")];
    if (byCategory) done.add(byCategory);
  }
  return done;
}

export function outstandingDeliverables(x: {
  isComp: boolean;
  isPt: boolean;
  dietConsultDone: boolean;
  trainerConsultDone: boolean;
  hasChart: boolean;
  hasWorkout: boolean;
  compBloodSubmitted: boolean | null;
}): DeliverableKey[] {
  const out: DeliverableKey[] = [];
  if (x.isComp && x.compBloodSubmitted === false) out.push("compblood");
  if (x.isComp && x.dietConsultDone && !x.hasChart) out.push("dietchart");
  if ((x.isComp || x.isPt) && x.trainerConsultDone && !x.hasWorkout) out.push("workout");
  return out;
}


/**
 * The one answer to "when did this client's clock start".
 *
 * `care_protocols.start_date` wins where a protocol row exists; the package's
 * own start is the fallback for clients who predate protocols or were never
 * given one.
 *
 * It lives here because the follow-up GENERATOR used the package date while
 * both attention engines preferred the protocol date. When those two differ,
 * the day-10 phone call and the day-10 booking gate land on different days for
 * the same client — the file header in lib/followups.ts says that exact bug was
 * fixed once already, by a different route.
 */
export function protocolStartFor(
  protocolStart: string | null | undefined,
  packageStart: string | null | undefined,
  joined?: string | null,
): string | null {
  return protocolStart ?? packageStart ?? joined ?? null;
}

// ---- which term is a client actually on? -----------------------------------
//
// A client can hold more than one active package at once, and renewing adds a
// second row without closing the first. Every dated engine then picked one for
// itself, and they picked differently:
//
//   • the client card asked for a single care-protocol row and got an error
//     when there were two, so it silently fell back to a package date;
//   • the dashboard built a map and kept whichever row the database returned
//     last — an order nothing guarantees;
//   • the length of the term came from an arbitrary one of the two, so how many
//     follow-up cycles a client owed changed between page loads;
//   • Today's agenda looped over every package row, so a renewed client's whole
//     milestone set appeared twice.
//
// One answer, used everywhere.

/** Same order as PRIORITY in lib/client-status.ts: care outranks facility. */
export const PACKAGE_PRIORITY = ["blueprint", "comprehensive", "training", "membership"];

export type TermPackage = { category: string | null; start_date: string | null; end_date: string | null };
export type TermProtocol = { protocol?: string | null; start_date: string | null };
export type Term = {
  category: string;
  /** The date every milestone counts from. */
  anchor: string;
  /** Length of the term in days — how many cycles the client owes. */
  spanDays: number;
  endDate: string | null;
};

const cat = (c: string | null | undefined) => (c ?? "").toLowerCase();

/**
 * The package term covering `today`, and the date its clock starts from.
 *
 * Chooses the richest care package the client holds (a gym membership never
 * governs care), then the term of THAT package which contains today. A client
 * whose renewal has already started is measured against the new term; one whose
 * terms have all expired keeps the most recent, because that is the work that
 * was last owed.
 *
 * Returns null when there is nothing dated to measure — no active package, or
 * one with no start date, which is a data problem rather than a schedule.
 */
export function currentTerm(
  packages: TermPackage[],
  protocols: TermProtocol[],
  today: string,
): Term | null {
  const active = packages.filter((p) => p.start_date);
  if (!active.length) return null;

  const category = PACKAGE_PRIORITY.find((p) => active.some((a) => cat(a.category) === p))
    ?? cat(active[0].category);
  const mine = active.filter((a) => cat(a.category) === category);

  // The term containing today; failing that, the one that started most
  // recently — a lapsed client is still measured against their last term.
  const covering = mine
    .filter((m) => m.start_date! <= today && (!m.end_date || m.end_date >= today))
    .sort((a, b) => b.start_date!.localeCompare(a.start_date!))[0];
  const pkg = covering ?? [...mine].sort((a, b) => b.start_date!.localeCompare(a.start_date!))[0];

  // The care-protocol row for this term, where one exists: the latest that
  // started on or before the package did, so a renewal's protocol row doesn't
  // re-anchor the term the client is currently living in.
  const proto = protocols
    .filter((r) => r.start_date && (!r.protocol || cat(r.protocol) === category))
    .filter((r) => r.start_date! <= pkg.start_date!)
    .sort((a, b) => b.start_date!.localeCompare(a.start_date!))[0];

  const anchor = protocolStartFor(proto?.start_date, pkg.start_date);
  if (!anchor) return null;

  const days = pkg.end_date
    ? Math.round((Date.parse(`${pkg.end_date}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86_400_000)
    : 28;
  return { category, anchor, spanDays: Math.max(28, days), endDate: pkg.end_date ?? null };
}
