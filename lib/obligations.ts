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
