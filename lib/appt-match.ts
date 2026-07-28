// Appointment type ↔ milestone matching.
//
// Milestones and the initial-consult guard key off a *category*
// ("Diet Consultation", "Doctor Consultation", "Fitness Services", …). But an
// appointment's stored `type` can be either that category (auto-created
// milestone bookings, legacy rows) OR a specific service name from the catalogue
// ("10th Day Diet Followup"), now that the booking form is driven by Services.
//
// This resolves both forms to the same category so the "already booked?" checks
// never disagree with what's actually on the calendar. Legacy / generic types
// ("Consultation", "Follow-up", …) pass through unchanged.

export const APPT_CATEGORIES = ["Doctor Consultation", "Diet Consultation", "Fitness Services", "Counselling", "Coaching"];

export type CatOf = (type: string | null | undefined) => string | null;

/** Build a resolver from a services catalogue (name → category). */
export function makeCatOf(services: { name: string; category: string }[]): CatOf {
  const byName = new Map(services.map((s) => [s.name, s.category]));
  return (type) => (type ? byName.get(type) ?? type : null);
}

/** Load the full services catalogue (active or not — historical bookings may
 *  reference a since-deactivated service) and return a category resolver. */
export async function loadCatOf(
  sb: { from: (table: string) => { select: (columns: string) => PromiseLike<{ data: unknown }> } },
): Promise<CatOf> {
  const { data } = await sb.from("services").select("name, category");
  return makeCatOf((data ?? []) as { name: string; category: string }[]);
}

/** Return a copy of the appointments with each `type` replaced by its resolved
 *  category, so downstream matching (which compares against category strings)
 *  works whether a booking was auto-created or booked manually by service name. */
export function normalizeApptTypes<T extends { type: string | null }>(appts: T[], catOf: CatOf): T[] {
  return appts.map((a) => ({ ...a, type: catOf(a.type) }));
}

/** Is this an *initial* consult of its discipline — the once-per-package
 *  booking the duplicate guard limits? Covers "Initial …" services and the
 *  legacy generic "Consultation" / "Assessment" types. */
export function isInitialApptType(type: string | null | undefined): boolean {
  const t = (type ?? "").toLowerCase();
  return t.startsWith("initial") || t === "consultation" || t === "assessment";
}

/** Service category → booking-form discipline (display) name. */
export const CATEGORY_TO_DISC: Record<string, string> = {
  "Doctor Consultation": "Doctor",
  "Diet Consultation": "Dietitian",
  "Fitness Services": "Fitness Trainer",
  "Counselling": "Psychologist",
  "Coaching": "Health Coach",
};

/** The specific catalogue service a milestone books — matched by category +
 *  day-offset (e.g. Diet Consultation @ day 10 → "10th Day Diet Followup"). */
export function serviceForMilestone(
  category: string,
  dayFrom: number,
  services: { name: string; category: string; day_offset: number | null }[],
): string | null {
  const svc = services.find((s) => s.category === category && (s.day_offset ?? -1) === dayFrom)
    ?? services.find((s) => s.category === category && /followup|follow-up|review|reassess/i.test(s.name));
  return svc?.name ?? null;
}

/** Build a pre-filled booking link for a milestone: patient + discipline + the
 *  specific service (matched by category + day-offset). Opening it lands the
 *  booking form with the obvious Type selected and — via the form's care-team
 *  default — the assigned provider filled in, so the booking is one click. */
export function milestoneBookHref(
  clientId: string,
  category: string,
  dayFrom: number,
  services: { name: string; category: string; day_offset: number | null }[],
): string {
  const disc = CATEGORY_TO_DISC[category];
  const svc = serviceForMilestone(category, dayFrom, services);
  const params = new URLSearchParams({ client: clientId });
  if (disc) params.set("disc", disc);
  if (svc) params.set("type", svc);
  return `/appointments?${params.toString()}`;
}

/** Is a milestone satisfied by an existing booking? A booking counts when either
 *  its type is the milestone's specific service (any date — an early booking
 *  still counts), or it's a legacy category-typed appointment falling within the
 *  milestone's date window. `catOf` resolves service names to their category. */
export function milestoneSatisfied(
  appts: { type: string | null; date: string | null; status: string }[],
  opts: { category: string; fromDate: string; service: string | null; catOf: CatOf },
): boolean {
  return appts.some((a) => {
    if (a.status !== "completed" && a.status !== "scheduled") return false;
    if (opts.service && a.type === opts.service) return true;
    return opts.catOf(a.type) === opts.category && !!a.date && a.date >= opts.fromDate;
  });
}
