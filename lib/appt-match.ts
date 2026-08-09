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

/**
 * Build a resolver from a services catalogue (name → category).
 *
 * Two catalogue rows can share a name — the same service filed under two
 * categories, which happens when someone adds it twice. The map used to take
 * whichever row Postgres returned last, an order nothing guarantees, so the
 * resolver could land on a category no milestone knows about and matching would
 * silently stop working for that discipline.
 *
 * So a duplicate name resolves to the category the rest of the system actually
 * uses, and only falls back to the arbitrary one when neither is recognised.
 * This does not make a duplicated service correct — it stops one from breaking
 * bookings while nobody has noticed it yet.
 */
export function makeCatOf(services: { name: string; category: string }[]): CatOf {
  const known = new Set(APPT_CATEGORIES);
  const byName = new Map<string, string>();
  for (const s of services) {
    const prev = byName.get(s.name);
    if (prev === undefined || (!known.has(prev) && known.has(s.category))) byName.set(s.name, s.category);
  }
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
  const inCat = services.filter((s) => s.category === category);
  if (!inCat.length) return null;
  // 1. Exact day-offset match (the happy path).
  const exact = inCat.find((s) => (s.day_offset ?? -1) === dayFrom);
  if (exact) return exact.name;
  // 2. Resilient to a service's day being edited: pick the day-scheduled service
  //    in this category whose day is closest to the milestone's day.
  const dated = inCat.filter((s) => s.day_offset != null);
  if (dated.length) {
    return dated.reduce((best, s) =>
      Math.abs((s.day_offset ?? 0) - dayFrom) < Math.abs((best.day_offset ?? 0) - dayFrom) ? s : best,
    ).name;
  }
  // 3. Last resort: a follow-up/review/reassessment service by name.
  return inCat.find((s) => /followup|follow-up|review|reassess/i.test(s.name))?.name ?? null;
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
  back?: "timeline" | "overview",
): string {
  const disc = CATEGORY_TO_DISC[category];
  const svc = serviceForMilestone(category, dayFrom, services);
  const params = new URLSearchParams({ client: clientId });
  if (disc) params.set("disc", disc);
  if (svc) params.set("type", svc);
  if (back) params.set("back", back);
  return `/appointments?${params.toString()}`;
}

/** How far BEFORE a milestone opens a booking may sit and still count for it.
 *  Clients book the day-10 follow-up when they're in the clinic on day 6; that
 *  should satisfy it, but not from an arbitrary distance. */
export const MILESTONE_EARLY_GRACE_DAYS = 7;

const shiftISO = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Is a milestone satisfied by an existing booking?
 *
 * Two rules here, and both used to be wrong in ways that made the app say a
 * client owed nothing when they did:
 *
 * 1. WINDOW. A service-named booking used to count at ANY date. On a comp12
 *    client the day-10 diet follow-up recurs three times (day 10, 38, 66) and
 *    the names are identical, so one booking in cycle 1 marked cycles 2 and 3
 *    satisfied for the life of the package — while the nightly SLA cron, which
 *    checks the date properly, breached them and chased the dietitian. The
 *    booking must now fall inside this milestone's own window: from a week
 *    before it opens, up to (not including) the next cycle's `toDate`.
 *
 * 2. NO-SHOWS. `scheduled` used to count regardless of date, so a booking the
 *    client never attended and nobody cancelled satisfied the milestone
 *    forever. A `scheduled` appointment now only counts while it is still
 *    ahead — from the day after it was due, it is evidence of a missed
 *    appointment, not a met one. `completed` always counts.
 *
 * `catOf` resolves service names to their category, for legacy
 * category-typed appointments that predate the service catalogue.
 */
export type MilestoneApptRow = { type: string | null; date: string | null; status: string };

export type MilestoneMatchOpts = {
  category: string;
  fromDate: string;
  /** Exclusive upper bound — the next cycle's `fromDate`, or null if last. */
  toDate?: string | null;
  service: string | null;
  catOf: CatOf;
  /** Today, IST. Used only to tell a pending booking from a no-show. */
  today: string;
  /**
   * Only count sessions actually HELD.
   *
   * "Has this been dealt with?" and "when was it met?" are different questions.
   * A booking in the diary answers the first — there is nothing to chase — but
   * cannot date the second, because it hasn't happened yet.
   */
  heldOnly?: boolean;
};

/**
 * Does this appointment's type belong to this milestone?
 *
 * The old rule ended `return catOf(a.type) === category`, which ran even when
 * the milestone named a specific service — so ANY appointment in the discipline
 * closed it. Two things went wrong with that:
 *
 *   • an initial consult satisfied a later follow-up. Front desk has two days
 *     just to book the initial diet consultation, so a day-3 initial sits
 *     comfortably inside the day-10 follow-up's window and the follow-up
 *     vanished from every screen — while the nightly sweep, which matches on
 *     exact dates, still breached it and chased the dietitian for it;
 *   • on a 12-week plan the day-21 review closed the day-10 follow-up, because
 *     both resolve to "Diet Consultation" and the day-10 window runs to day 38.
 *
 * So the specific service wins where the milestone names one, a bare category
 * still matches for rows that predate the catalogue, and an initial consult is
 * never a follow-up.
 */
function typeBelongsTo(type: string | null, opts: MilestoneMatchOpts): boolean {
  if (opts.service && type === opts.service) return true;
  if (isInitialApptType(type)) return false;
  // Rows booked before the service catalogue existed carry the bare category.
  if (type === opts.category) return true;
  // The milestone named a service and this row names a different one — that is
  // a different piece of work, however similar the discipline.
  if (opts.service) return false;
  return opts.catOf(type) === opts.category;
}

/**
 * The appointment that meets this milestone, earliest first, or null.
 *
 * Returns the row rather than a boolean so the SLA board can ask WHEN the gate
 * was met from the same rule the attention panels use to ask WHETHER it was.
 * Three separate implementations of this used to disagree: booking a day-10
 * follow-up early, for day 8, dropped it from the client card while the nightly
 * sweep still fired "deadline missed" at the dietitian and management, plus a
 * duplicate "book it" task.
 */
export function milestoneMatch<T extends MilestoneApptRow>(
  appts: T[],
  opts: MilestoneMatchOpts,
): T | null {
  const earliest = shiftISO(opts.fromDate, -MILESTONE_EARLY_GRACE_DAYS);
  const hits = appts.filter((a) => {
    if (!a.date) return false;
    if (a.status === "completed") {
      // held, so it counts — provided it was this cycle's
    } else if (a.status === "scheduled" && !opts.heldOnly) {
      if (a.date < opts.today) return false;   // due and never held → no-show
    } else {
      return false;                             // cancelled, no-show, anything else
    }
    if (a.date < earliest) return false;
    if (opts.toDate && a.date >= opts.toDate) return false;
    return typeBelongsTo(a.type, opts);
  });
  hits.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return hits[0] ?? null;
}

/** Is there nothing left to chase for this milestone? */
export function milestoneSatisfied(
  appts: MilestoneApptRow[],
  opts: MilestoneMatchOpts,
): boolean {
  return milestoneMatch(appts, opts) !== null;
}
