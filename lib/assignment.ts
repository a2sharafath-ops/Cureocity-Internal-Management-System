// Care-team assignment rules.
//
// Two different mechanisms, by discipline:
//
//   Doctor / Dietitian / Psychologist — follow the booking. Whoever the client
//     was booked with for their initial appointment in that discipline becomes
//     their ongoing provider. No rotation: the person they first met is theirs.
//
//   Health Coach — rotation. The coach carrying the fewest clients takes the
//     next one; ties go to whoever joined the company first.
//
//   Fitness Trainer — rotation too, but constrained by the slot the client
//     picked: only trainers actually free at that date and hour are eligible,
//     and among those the same least-loaded / longest-serving rule applies.
//
// Everything here is pure so it can be reasoned about and tested directly; the
// server action in lib/actions.ts does the database reads and writes.

export const DISCIPLINES = ["doctor", "dietitian", "psychologist", "coach", "trainer"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

/** Which staff role staffs each discipline. */
export const ROLE_FOR: Record<Discipline, string> = {
  doctor: "Doctor",
  dietitian: "Dietitian",
  psychologist: "Psychologist",
  coach: "Health Coach",
  trainer: "Fitness Trainer",
};

/**
 * Which disciplines make up the care team for each package category.
 *   BluePrint & Comprehensive — full clinical team: doctor, dietitian, trainer,
 *     health coach (no psychologist).
 *   PT (training) — trainer + health coach only.
 *   Membership / other — no clinical care team.
 */
export function disciplinesForCategory(category: string): Discipline[] {
  switch (category) {
    case "blueprint":
    case "comprehensive":
      return ["doctor", "dietitian", "trainer", "coach"];
    case "training":
      return ["trainer", "coach"];
    default:
      return [];
  }
}

/** How the assignment was arrived at — stored so the choice is auditable. */
export type Method = "booking" | "rotation" | "manual";

export type Candidate = {
  id: string;
  name: string;
  /** ISO timestamp the staff member joined — the tie-break. */
  joined: string;
  /** How many clients they already carry in this discipline. */
  load: number;
};

export type Booking = {
  provider_id: string | null;
  /** appointment `type` — matched loosely against the discipline. */
  type: string | null;
  date: string;
  hour: number;
  status: string;
};

export type Busy = { trainer_id: string; date: string; hour: number };

/**
 * Least-loaded wins; ties broken by who joined first, then by id so the result
 * is deterministic even when two people joined at the same instant.
 */
export function pickByRotation(candidates: Candidate[]): Candidate | null {
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) =>
    a.load - b.load ||
    a.joined.localeCompare(b.joined) ||
    a.id.localeCompare(b.id)
  )[0];
}

// NOTE: assignment maps a booking to a discipline by the PROVIDER'S ROLE (their
// membership in that discipline's candidate pool), not by the appointment's
// free-text type — see planCareTeam step 1. Earlier helpers that matched on the
// type string (bookingMatches / providerFromInitialBooking) were removed: they
// were unused and encoded a rule the engine deliberately does not follow.

/** Trainers with nothing already booked at that exact date and hour. */
export function freeAt(candidates: Candidate[], busy: Busy[], date: string, hour: number): Candidate[] {
  const taken = new Set(busy.filter((b) => b.date === date && b.hour === hour).map((b) => b.trainer_id));
  return candidates.filter((c) => !taken.has(c.id));
}

export type Assignment = { discipline: Discipline; staff_id: string; method: Method };

/**
 * Work out the full care team for one client. Disciplines with no eligible
 * staff — or no initial booking yet — are simply left out, to be filled in
 * once the booking happens.
 */
export function planCareTeam(input: {
  bookings: Booking[];
  /** candidate pool per discipline, already loaded with current client counts */
  pool: Record<Discipline, Candidate[]>;
  /** trainer commitments, for slot conflict checking */
  busy: Busy[];
  /** the slot the client chose for training, if they picked one */
  slot?: { date: string; hour: number } | null;
}): Assignment[] {
  const out: Assignment[] = [];

  // 1. Booking-led disciplines. The discipline is decided by the *provider's
  //    role* (their presence in that discipline's candidate pool), NOT by the
  //    appointment's free-text type — a generic "Consultation" says nothing
  //    about whether the provider is a doctor or a dietitian. The earliest
  //    non-cancelled booking with a correctly-rolled provider wins.
  for (const d of ["doctor", "dietitian", "psychologist"] as const) {
    const ids = new Set(input.pool[d].map((c) => c.id));
    const mine = input.bookings
      .filter((b) => b.provider_id && b.status !== "cancelled" && ids.has(b.provider_id))
      .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
    const staff_id = mine[0]?.provider_id ?? null;
    if (staff_id) out.push({ discipline: d, staff_id, method: "booking" });
  }

  // 2. Health coach — pure rotation.
  const coach = pickByRotation(input.pool.coach);
  if (coach) out.push({ discipline: "coach", staff_id: coach.id, method: "rotation" });

  // 3. Trainer — rotation among those free at the chosen slot.
  const eligible = input.slot
    ? freeAt(input.pool.trainer, input.busy, input.slot.date, input.slot.hour)
    : input.pool.trainer;
  const trainer = pickByRotation(eligible);
  if (trainer) out.push({ discipline: "trainer", staff_id: trainer.id, method: "rotation" });

  return out;
}

/**
 * The single "assigned pro" shown on the clients list. Prefer the doctor, then
 * the trainer, then whatever else exists — so the column shows the most
 * clinically senior person on the case.
 */
export function primaryPro(assignments: Assignment[]): string | null {
  const order: Discipline[] = ["doctor", "trainer", "dietitian", "psychologist", "coach"];
  for (const d of order) {
    const hit = assignments.find((a) => a.discipline === d);
    if (hit) return hit.staff_id;
  }
  return null;
}
