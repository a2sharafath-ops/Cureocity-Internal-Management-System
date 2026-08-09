import { describe, it, expect } from "vitest";
import {
  makeCatOf, isInitialApptType, serviceForMilestone, milestoneSatisfied, milestoneMatch, milestoneBookHref,
} from "@/lib/appt-match";

// The real catalogue shape (name / category / day_offset).
const SERVICES = [
  { name: "Initial Diet Consultation", category: "Diet Consultation", day_offset: null },
  { name: "10th Day Diet Followup", category: "Diet Consultation", day_offset: 10 },
  { name: "21st Day Diet Followup", category: "Diet Consultation", day_offset: 21 },
  { name: "Diet Chart Explanation", category: "Diet Consultation", day_offset: 2 },
  { name: "Initial Doctor Consultation", category: "Doctor Consultation", day_offset: null },
  { name: "Doctor Followup (28 days)", category: "Doctor Consultation", day_offset: 28 },
  { name: "Initial Fitness Consultation", category: "Fitness Services", day_offset: null },
  { name: "Fitness Reassessment", category: "Fitness Services", day_offset: 21 },
];

describe("makeCatOf", () => {
  const catOf = makeCatOf(SERVICES);
  it("resolves a service name to its category", () => {
    expect(catOf("10th Day Diet Followup")).toBe("Diet Consultation");
    expect(catOf("Fitness Reassessment")).toBe("Fitness Services");
  });
  it("passes a category string through unchanged", () => {
    expect(catOf("Diet Consultation")).toBe("Diet Consultation");
  });
  it("passes an unknown/legacy type through unchanged", () => {
    expect(catOf("Consultation")).toBe("Consultation");
    expect(catOf(null)).toBe(null);
  });
});

describe("isInitialApptType", () => {
  it("is true for Initial services and legacy generics", () => {
    expect(isInitialApptType("Initial Diet Consultation")).toBe(true);
    expect(isInitialApptType("Consultation")).toBe(true);
    expect(isInitialApptType("Assessment")).toBe(true);
  });
  it("is false for follow-up services", () => {
    expect(isInitialApptType("10th Day Diet Followup")).toBe(false);
    expect(isInitialApptType("Doctor Followup (28 days)")).toBe(false);
    expect(isInitialApptType(null)).toBe(false);
  });
});

describe("serviceForMilestone", () => {
  it("matches by category + exact day", () => {
    expect(serviceForMilestone("Diet Consultation", 10, SERVICES)).toBe("10th Day Diet Followup");
    expect(serviceForMilestone("Diet Consultation", 21, SERVICES)).toBe("21st Day Diet Followup");
    expect(serviceForMilestone("Doctor Consultation", 28, SERVICES)).toBe("Doctor Followup (28 days)");
    expect(serviceForMilestone("Fitness Services", 21, SERVICES)).toBe("Fitness Reassessment");
  });
  it("falls back to the nearest-day service when the exact day was edited", () => {
    // day 11 no longer matches any exactly; nearest dated diet service is day 10.
    expect(serviceForMilestone("Diet Consultation", 11, SERVICES)).toBe("10th Day Diet Followup");
  });
  it("returns null when the category has no service", () => {
    expect(serviceForMilestone("Counselling", 10, SERVICES)).toBe(null);
  });
});

describe("milestoneSatisfied", () => {
  const catOf = makeCatOf(SERVICES);
  // "today" matters now: a scheduled booking in the past is a no-show.
  const base = { category: "Diet Consultation", fromDate: "2026-08-05", service: "10th Day Diet Followup", catOf, today: "2026-07-25" };

  it("counts a service-named booking made a few days early", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-07-29", status: "scheduled" }];
    expect(milestoneSatisfied(appts, base)).toBe(true);
  });
  it("does NOT count one booked long before the window opens", () => {
    // Beyond MILESTONE_EARLY_GRACE_DAYS — on a repeating protocol that booking
    // belongs to the previous cycle, not this one.
    const appts = [{ type: "10th Day Diet Followup", date: "2026-07-01", status: "completed" }];
    expect(milestoneSatisfied(appts, base)).toBe(false);
  });
  it("does NOT count one on/after the next cycle's start", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-09-02", status: "completed" }];
    expect(milestoneSatisfied(appts, { ...base, toDate: "2026-09-02" })).toBe(false);
  });
  it("counts a legacy category booking within the date window", () => {
    const appts = [{ type: "Diet Consultation", date: "2026-08-06", status: "completed" }];
    expect(milestoneSatisfied(appts, base)).toBe(true);
  });
  it("treats a past 'scheduled' booking as a no-show, not a hit", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-08-06", status: "scheduled" }];
    expect(milestoneSatisfied(appts, { ...base, today: "2026-08-20" })).toBe(false);
  });
  it("does NOT count a legacy category booking before the window", () => {
    const appts = [{ type: "Diet Consultation", date: "2026-07-20", status: "scheduled" }];
    expect(milestoneSatisfied(appts, base)).toBe(false);
  });
  it("ignores cancelled / no-show bookings", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-08-06", status: "cancelled" }];
    expect(milestoneSatisfied(appts, base)).toBe(false);
  });
});

describe("milestoneBookHref", () => {
  it("carries client, discipline, specific service and back tab", () => {
    const href = milestoneBookHref("c1", "Diet Consultation", 10, SERVICES, "timeline");
    expect(href).toContain("client=c1");
    expect(href).toContain("disc=Dietitian");
    expect(href).toContain("type=10th+Day+Diet+Followup");
    expect(href).toContain("back=timeline");
  });
});

describe("makeCatOf — a service name filed under two categories", () => {
  // Real case: "Initial Psychology Consultation" existed under both
  // "Counselling" (the category milestones use) and "Psychology" (a stray).
  // Whichever row came back last won, so psychology bookings could resolve to a
  // category nothing matches on.
  const dup = [
    { name: "Initial Psychology Consultation", category: "Psychology" },
    { name: "Initial Psychology Consultation", category: "Counselling" },
  ];

  it("prefers the category the rest of the system books against", () => {
    expect(makeCatOf(dup)("Initial Psychology Consultation")).toBe("Counselling");
  });

  it("gives the same answer whichever order the rows arrive in", () => {
    expect(makeCatOf([...dup].reverse())("Initial Psychology Consultation")).toBe("Counselling");
  });

  it("still resolves a name that only exists under an unknown category", () => {
    const only = [{ name: "Sound Bath", category: "Wellbeing" }];
    expect(makeCatOf(only)("Sound Bath")).toBe("Wellbeing");
  });
});

describe("an initial consultation never closes a later follow-up", () => {
  const services = [
    { name: "Initial Diet Consultation", category: "Diet Consultation", day_offset: 0 },
    { name: "10th Day Diet Followup", category: "Diet Consultation", day_offset: 10 },
    { name: "21st Day Diet Followup", category: "Diet Consultation", day_offset: 21 },
  ];
  const catOf = makeCatOf(services);
  // Day 10 of a package starting 1 Jan. Front desk has two days just to BOOK
  // the initial consult, so it commonly lands on day 3 — inside the day-10
  // milestone's early-grace window.
  const day10 = { category: "Diet Consultation", fromDate: "2026-01-11", toDate: null,
                  service: "10th Day Diet Followup", catOf, today: "2026-01-20" };

  it("does not let a day-3 initial consult satisfy the day-10 follow-up", () => {
    // The bug: it did, so the follow-up vanished from the client card and the
    // dashboard while the nightly sweep still breached it and chased the
    // dietitian for work it thought was late.
    const appts = [{ type: "Initial Diet Consultation", date: "2026-01-04", status: "completed" }];
    expect(milestoneSatisfied(appts, day10)).toBe(false);
  });

  it("does let the day-10 follow-up itself satisfy it", () => {
    expect(milestoneSatisfied([{ type: "10th Day Diet Followup", date: "2026-01-11", status: "completed" }], day10)).toBe(true);
  });

  it("does not let the day-21 review satisfy the day-10 follow-up", () => {
    // Both are Diet Consultation, and the day-10 window runs on past day 21.
    expect(milestoneSatisfied([{ type: "21st Day Diet Followup", date: "2026-01-22", status: "completed" }], day10)).toBe(false);
  });

  it("still accepts a row typed with the bare category — those predate the catalogue", () => {
    expect(milestoneSatisfied([{ type: "Diet Consultation", date: "2026-01-12", status: "completed" }], day10)).toBe(true);
  });

  it("keeps the early-booking grace for the right service", () => {
    // Held on day 8 while the client was in the clinic — that counts.
    expect(milestoneSatisfied([{ type: "10th Day Diet Followup", date: "2026-01-09", status: "completed" }], day10)).toBe(true);
    // And a booking still ahead of today counts as nothing to chase.
    expect(milestoneSatisfied([{ type: "10th Day Diet Followup", date: "2026-01-09", status: "scheduled" }],
      { ...day10, today: "2026-01-08" })).toBe(true);
  });
});

describe("milestoneMatch — whether, and when", () => {
  const catOf = makeCatOf([{ name: "10th Day Diet Followup", category: "Diet Consultation" }]);
  const opts = { category: "Diet Consultation", fromDate: "2026-01-11", toDate: null,
                 service: "10th Day Diet Followup", catOf, today: "2026-01-12" };

  it("returns the earliest qualifying appointment", () => {
    const hit = milestoneMatch([
      { type: "10th Day Diet Followup", date: "2026-01-15", status: "completed" },
      { type: "10th Day Diet Followup", date: "2026-01-11", status: "completed" },
    ], opts);
    expect(hit?.date).toBe("2026-01-11");
  });

  it("counts a booking still to come as nothing to chase", () => {
    expect(milestoneMatch([{ type: "10th Day Diet Followup", date: "2026-01-20", status: "scheduled" }], opts)).not.toBeNull();
  });

  it("but a booking cannot DATE a gate that has not happened", () => {
    // heldOnly is what the turnaround board uses: "when was this met" cannot be
    // answered by an appointment in the future.
    expect(milestoneMatch([{ type: "10th Day Diet Followup", date: "2026-01-20", status: "scheduled" }],
      { ...opts, heldOnly: true })).toBeNull();
  });

  it("returns null when nothing qualifies", () => {
    expect(milestoneMatch([], opts)).toBeNull();
  });
});
