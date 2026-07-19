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

/** Does an appointment belong to this discipline? */
export function bookingMatches(type: string | null, d: Discipline): boolean {
  const t = (type ?? "").toLowerCase();
  if (d === "doctor") return t.includes("doctor") || t.includes("consult") || t.includes("physician") || t.includes("medical");
  if (d === "dietitian") return t.includes("diet") || t.includes("nutrition");
  if (d === "psychologist") return t.includes("psych") || t.includes("counsel") || t.includes("mental");
  if (d === "coach") return t.includes("coach");
  if (d === "trainer") return t.includes("train") || t.includes("fitness") || t.includes("assessment") || t.includes("pt");
  return false;
}

/**
 * The provider on the client's *initial* booking in this discipline —
 * earliest by date, then hour. Cancelled bookings don't count.
 */
export function providerFromInitialBooking(bookings: Booking[], d: Discipline): string | null {
  const mine = bookings
    .filter((b) => b.provider_id && b.status !== "cancelled" && bookingMatches(b.type, d))
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour);
  return mine[0]?.provider_id ?? null;
}

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

  // 1. Booking-led disciplines.
  for (const d of ["doctor", "dietitian", "psychologist"] as const) {
    const fromBooking = providerFromInitialBooking(input.bookings, d);
    if (fromBooking) out.push({ discipline: d, staff_id: fromBooking, method: "booking" });
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
