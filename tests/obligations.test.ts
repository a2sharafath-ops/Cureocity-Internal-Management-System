import { describe, it, expect } from "vitest";
import { buildOwnerResolver, outstandingDeliverables, unsatisfiedMilestones, renewalWindow, RENEWAL_LEAD_DAYS, RENEWAL_LAPSED_DAYS, ROLE_TO_DISC, type AssignRow, type ApptOwnerRow, type MilestoneLike } from "@/lib/obligations";

const shift = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---- buildOwnerResolver -----------------------------------------------------
// Locks the parity of the owner-resolution logic that used to be copy-pasted in
// package-status.ts and care-attention.ts: care-team assignment first, then the
// completed-consult provider as fallback.
describe("buildOwnerResolver", () => {
  const A = (client_id: string, discipline: string, staff_id: string | null, name: string | null): AssignRow =>
    ({ client_id, discipline, staff_id, staff: name ? { name } : null });
  const P = (client_id: string, status: string, provider_id: string | null, name: string, role: string): ApptOwnerRow =>
    ({ client_id, status, provider_id, staff: { name, role } });

  it("resolves the explicit care-team assignment", () => {
    const owner = buildOwnerResolver([A("c1", "coach", "s1", "Shahanas")], []);
    expect(owner("c1", "coach")).toEqual({ id: "s1", name: "Shahanas" });
  });

  it("returns undefined when nothing is known", () => {
    const owner = buildOwnerResolver([], []);
    expect(owner("c1", "coach")).toBeUndefined();
  });

  it("falls back to the completed-consult provider when unassigned", () => {
    const owner = buildOwnerResolver([], [P("c1", "completed", "d1", "Afya", "Dietitian")]);
    expect(owner("c1", "dietitian")).toEqual({ id: "d1", name: "Afya" });
  });

  it("prefers the assignment over the fallback", () => {
    const owner = buildOwnerResolver(
      [A("c1", "dietitian", "assigned", "Assigned Diet")],
      [P("c1", "completed", "ran", "Ran Consult", "Dietitian")],
    );
    expect(owner("c1", "dietitian")).toEqual({ id: "assigned", name: "Assigned Diet" });
  });

  it("ignores non-completed appointments for the fallback", () => {
    const owner = buildOwnerResolver([], [P("c1", "scheduled", "d1", "Afya", "Dietitian")]);
    expect(owner("c1", "dietitian")).toBeUndefined();
  });

  it("first completed consult per (client, discipline) wins the fallback", () => {
    const owner = buildOwnerResolver([], [
      P("c1", "completed", "first", "First", "Doctor"),
      P("c1", "completed", "second", "Second", "Doctor"),
    ]);
    expect(owner("c1", "doctor")).toEqual({ id: "first", name: "First" });
  });

  it("keeps owners scoped per client", () => {
    const owner = buildOwnerResolver([A("c1", "coach", "s1", "One"), A("c2", "coach", "s2", "Two")], []);
    expect(owner("c1", "coach")).toEqual({ id: "s1", name: "One" });
    expect(owner("c2", "coach")).toEqual({ id: "s2", name: "Two" });
  });

  it("skips assignment rows with no staff_id", () => {
    const owner = buildOwnerResolver([A("c1", "coach", null, null)], []);
    expect(owner("c1", "coach")).toBeUndefined();
  });

  it("maps every provider role to a discipline", () => {
    expect(ROLE_TO_DISC).toMatchObject({
      Doctor: "doctor", Dietitian: "dietitian", "Fitness Trainer": "trainer",
      "Health Coach": "coach", Psychologist: "psychologist",
    });
  });
});

// ---- outstandingDeliverables ------------------------------------------------
const base = {
  isComp: false, isPt: false,
  dietConsultDone: false, trainerConsultDone: false,
  hasChart: false, hasWorkout: false, compBloodSubmitted: null as boolean | null,
};

describe("outstandingDeliverables", () => {
  it("flags a comprehensive blood report that isn't submitted", () => {
    expect(outstandingDeliverables({ ...base, isComp: true, compBloodSubmitted: false })).toContain("compblood");
  });
  it("does not flag blood once submitted, or when there's no blood row", () => {
    expect(outstandingDeliverables({ ...base, isComp: true, compBloodSubmitted: true })).not.toContain("compblood");
    expect(outstandingDeliverables({ ...base, isComp: true, compBloodSubmitted: null })).not.toContain("compblood");
  });
  it("flags the diet chart only after the diet consult and when no chart exists", () => {
    expect(outstandingDeliverables({ ...base, isComp: true, dietConsultDone: true, hasChart: false })).toContain("dietchart");
    expect(outstandingDeliverables({ ...base, isComp: true, dietConsultDone: false })).not.toContain("dietchart");
    expect(outstandingDeliverables({ ...base, isComp: true, dietConsultDone: true, hasChart: true })).not.toContain("dietchart");
  });
  it("flags the workout for BOTH Comprehensive and PT clients", () => {
    expect(outstandingDeliverables({ ...base, isComp: true, trainerConsultDone: true })).toContain("workout");
    expect(outstandingDeliverables({ ...base, isPt: true, trainerConsultDone: true })).toContain("workout");
  });
  it("does not flag the workout once a plan exists or the assessment isn't done", () => {
    expect(outstandingDeliverables({ ...base, isPt: true, trainerConsultDone: true, hasWorkout: true })).not.toContain("workout");
    expect(outstandingDeliverables({ ...base, isPt: true, trainerConsultDone: false })).not.toContain("workout");
  });
  it("returns nothing for a plain membership client", () => {
    expect(outstandingDeliverables({ ...base, dietConsultDone: true, trainerConsultDone: true, compBloodSubmitted: false })).toEqual([]);
  });
  it("keeps a stable order: compblood, dietchart, workout", () => {
    expect(outstandingDeliverables({
      ...base, isComp: true, compBloodSubmitted: false,
      dietConsultDone: true, trainerConsultDone: true,
    })).toEqual(["compblood", "dietchart", "workout"]);
  });
});

// ---- unsatisfiedMilestones --------------------------------------------------
const SVC = [
  { name: "10th Day Diet Followup", category: "Diet Consultation", day_offset: 10 },
  { name: "Day 28 doctor review", category: "Doctor Consultation", day_offset: 28 },
];
// Fixed "today" for the no-show rule: a scheduled booking in the past is a
// missed appointment, not a met milestone.
const TODAY = "2026-08-20";
const ms = (over: Partial<MilestoneLike>): MilestoneLike =>
  ({ apptType: "Diet Consultation", from: 10, fromDate: "2026-08-10", dueDate: "2026-08-10", label: "Day 10 diet follow-up", gate: "diet_10", ...over });

describe("unsatisfiedMilestones", () => {
  it("keeps a milestone with no matching booking, and attaches a Book link", () => {
    const out = unsatisfiedMilestones("c1", [ms({})], [], SVC, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0].bookHref).toContain("c1");
  });
  it("drops a milestone already satisfied by a booking on/after fromDate", () => {
    // `completed`, not `scheduled`: a booking left scheduled in the PAST is now
    // read as a no-show rather than a met milestone. The pending-booking case
    // has its own test under "no-shows" below.
    const appts = [{ type: "Diet Consultation", date: "2026-08-12", status: "completed" }];
    expect(unsatisfiedMilestones("c1", [ms({})], appts, SVC, TODAY)).toHaveLength(0);
  });
  it("does not count a cancelled booking as satisfying the milestone", () => {
    const appts = [{ type: "Diet Consultation", date: "2026-08-12", status: "cancelled" }];
    expect(unsatisfiedMilestones("c1", [ms({})], appts, SVC, TODAY)).toHaveLength(1);
  });
  it("preserves the input order of unsatisfied milestones", () => {
    const out = unsatisfiedMilestones("c1", [
      ms({ gate: "diet_10", dueDate: "2026-08-10" }),
      ms({ gate: "doctor_28", apptType: "Doctor Consultation", from: 28, fromDate: "2026-08-28", dueDate: "2026-08-28", label: "Day 28 doctor review" }),
    ], [], SVC, TODAY);
    expect(out.map((m) => m.gate)).toEqual(["diet_10", "doctor_28"]);
  });
});

// ---- the cycle bug ----------------------------------------------------------
// On comp12 the day-10 diet follow-up recurs at day 10, 38 and 66 under one
// service name. A single booking used to satisfy all three for the life of the
// package, because the service-name branch ignored the date entirely — while
// the nightly SLA cron, which checks dates, breached cycles 2 and 3 and chased
// the dietitian. The client got one follow-up in twelve weeks instead of three.
describe("unsatisfiedMilestones — repeating cycles", () => {
  const cycles = [
    ms({ gate: "diet_10#1", fromDate: "2026-08-10", dueDate: "2026-08-10" }),
    ms({ gate: "diet_10#2", fromDate: "2026-09-07", dueDate: "2026-09-07" }),
    ms({ gate: "diet_10#3", fromDate: "2026-10-05", dueDate: "2026-10-05" }),
  ];

  it("a cycle-1 booking satisfies ONLY cycle 1", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-08-11", status: "completed" }];
    const out = unsatisfiedMilestones("c1", cycles, appts, SVC, TODAY);
    expect(out.map((m) => m.gate)).toEqual(["diet_10#2", "diet_10#3"]);
  });

  it("each cycle is satisfied by its own booking", () => {
    const appts = [
      { type: "10th Day Diet Followup", date: "2026-08-11", status: "completed" },
      { type: "10th Day Diet Followup", date: "2026-09-08", status: "completed" },
    ];
    const out = unsatisfiedMilestones("c1", cycles, appts, SVC, TODAY);
    expect(out.map((m) => m.gate)).toEqual(["diet_10#3"]);
  });

  it("still allows booking a week early — that was the point of the old rule", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-09-02", status: "scheduled" }];
    const out = unsatisfiedMilestones("c1", cycles, appts, SVC, "2026-09-01");
    expect(out.map((m) => m.gate)).not.toContain("diet_10#2");
  });

  it("does not let a booking count for a cycle it is far too early for", () => {
    // Booked 5 weeks before cycle 3 opens — that is cycle 2's appointment.
    const appts = [{ type: "10th Day Diet Followup", date: "2026-09-08", status: "completed" }];
    const out = unsatisfiedMilestones("c1", cycles, appts, SVC, TODAY);
    expect(out.map((m) => m.gate)).toContain("diet_10#3");
  });
});

// ---- no-shows ---------------------------------------------------------------
describe("unsatisfiedMilestones — no-shows", () => {
  it("a booking still ahead of us counts", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-08-25", status: "scheduled" }];
    expect(unsatisfiedMilestones("c1", [ms({ fromDate: "2026-08-20", dueDate: "2026-08-20" })], appts, SVC, TODAY)).toHaveLength(0);
  });

  it("a booking left 'scheduled' in the past does NOT — it was never held", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-08-11", status: "scheduled" }];
    expect(unsatisfiedMilestones("c1", [ms({})], appts, SVC, TODAY)).toHaveLength(1);
  });

  it("but a completed booking in the past does", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-08-11", status: "completed" }];
    expect(unsatisfiedMilestones("c1", [ms({})], appts, SVC, TODAY)).toHaveLength(0);
  });
});

// ---- renewalWindow ----------------------------------------------------------
// Ruling 6 (docs/obligations-rulings.md): a package ending reaches the front
// desk queue, not just that client's own card. The window is the whole safety
// of it — nothing in the app expires a package by date, so rows sit "active"
// long after they end, and an unbounded look-back would put every package the
// clinic has ever sold on the queue at once.
describe("renewalWindow", () => {
  const TODAY = "2026-08-09";

  it("chases a package ending inside the lead time", () => {
    expect(renewalWindow("2026-08-14", TODAY)).toEqual({ lapsed: false });
    expect(renewalWindow(shift(TODAY, RENEWAL_LEAD_DAYS), TODAY)).toEqual({ lapsed: false });
  });

  it("stays quiet about one ending beyond the lead time", () => {
    expect(renewalWindow(shift(TODAY, RENEWAL_LEAD_DAYS + 1), TODAY)).toBeNull();
    expect(renewalWindow("2026-12-31", TODAY)).toBeNull();
  });

  it("treats today as ending, not lapsed", () => {
    // Ruling 8: due today is not overdue — there is still a day to act.
    expect(renewalWindow(TODAY, TODAY)).toEqual({ lapsed: false });
  });

  it("marks yesterday as lapsed", () => {
    expect(renewalWindow("2026-08-08", TODAY)).toEqual({ lapsed: true });
  });

  it("stops chasing once it belongs to retention", () => {
    // The bound that matters: without it, every package ever sold would land on
    // the front desk queue, because nothing sets these rows inactive.
    expect(renewalWindow(shift(TODAY, -RENEWAL_LAPSED_DAYS), TODAY)).toEqual({ lapsed: true });
    expect(renewalWindow(shift(TODAY, -RENEWAL_LAPSED_DAYS - 1), TODAY)).toBeNull();
    expect(renewalWindow("2024-01-01", TODAY)).toBeNull();
  });

  it("ignores a package with no end date — nothing to renew", () => {
    expect(renewalWindow(null, TODAY)).toBeNull();
    expect(renewalWindow(undefined, TODAY)).toBeNull();
  });
});
