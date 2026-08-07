import { describe, it, expect } from "vitest";
import {
  BOOKING_OWNER, INVOICE_RAISE_OWNER, INVOICE_CHASE_OWNER, RENEWAL_OWNER,
  INTAKE_OWNER, BLOOD_CHASE_OWNER, DELIVERY_OWNER, sessionOwners,
  UNOWNED_CONCERN_DISCIPLINE, CONCERN_ESCALATION_OWNER, CONCERN_ESCALATION_DAYS,
  FOLLOWUP_QUEUE_OWNER, APPROVAL_OWNER,
} from "@/lib/work-owners";
import { INITIAL_BOOKINGS, MILESTONES } from "@/lib/comprehensive";
import { onboardingRow, type ClientInput } from "@/lib/onboarding";
import { disciplinesForCategory } from "@/lib/assignment";

// These tests exist to stop the rule drifting apart again. The whole reason
// lib/work-owners.ts was written is that the same obligation named different
// people on different screens.
describe("who owns what", () => {
  it("booking belongs to the Health Coach", () => {
    expect(BOOKING_OWNER).toEqual(["Health Coach"]);
  });

  it("money stays with front desk and finance", () => {
    expect(INVOICE_RAISE_OWNER).toEqual(["Front Desk", "Finance"]);
    expect(INVOICE_CHASE_OWNER).toEqual(["Front Desk", "Finance"]);
    expect(RENEWAL_OWNER).toEqual(["Front Desk"]);
    expect(INTAKE_OWNER).toEqual(["Front Desk"]);
    expect(FOLLOWUP_QUEUE_OWNER).toEqual(["Front Desk"]);
  });

  it("blood chasing is the coach's, approval is the director's", () => {
    expect(BLOOD_CHASE_OWNER).toEqual(["Health Coach"]);
    expect(APPROVAL_OWNER).toEqual(["Medical Director"]);
  });

  it("every discipline maps to exactly one delivering role", () => {
    expect(DELIVERY_OWNER.doctor).toEqual(["Doctor"]);
    expect(DELIVERY_OWNER.dietitian).toEqual(["Dietitian"]);
    expect(DELIVERY_OWNER.trainer).toEqual(["Fitness Trainer"]);
    expect(DELIVERY_OWNER.coach).toEqual(["Health Coach"]);
    expect(DELIVERY_OWNER.psychologist).toEqual(["Psychologist"]);
  });

  it("every milestone's owner resolves to a real delivering role", () => {
    // The bug this guards: MilestoneLike used to drop `owner`, so the queues
    // invented "Front Desk" as the owner of clinical work.
    for (const m of MILESTONES) {
      expect(DELIVERY_OWNER[m.owner], `milestone ${m.key} owner "${m.owner}"`).toBeDefined();
    }
  });

  it("sessions: a booked block is the trainer's, an empty diary is both", () => {
    expect(sessionOwners(true)).toEqual(["Fitness Trainer"]);
    expect(sessionOwners(false)).toEqual(["Health Coach", "Fitness Trainer"]);
  });

  it("a concern with no discipline falls to the coach, then the director", () => {
    expect(UNOWNED_CONCERN_DISCIPLINE).toBe("coach");
    expect(CONCERN_ESCALATION_OWNER).toEqual(["Medical Director"]);
    expect(CONCERN_ESCALATION_DAYS).toBeGreaterThan(0);
  });
});

describe("Comprehensive includes exactly one psychology consultation", () => {
  const base: ClientInput = {
    clientId: "c1", clientName: "A", category: "comprehensive", packageName: "Comprehensive",
    ownerName: null, hasInvoice: true, bloodRequested: true, bloodSubmitted: false,
    doctor: { scheduled: false, completed: false },
    diet: { scheduled: false, completed: false },
    trainer: { scheduled: false, completed: false },
    psych: { scheduled: false, completed: false },
    blueprintGenerated: false, sessionScheduled: false,
  };

  it("appears on the Comprehensive ladder, once", () => {
    const steps = onboardingRow(base).steps.filter((s) => /psychology/i.test(s.label));
    expect(steps).toHaveLength(1);
    expect(steps[0].label).toBe("Book psychology consultation");
  });

  it("is a day-0 initial booking, not a repeating milestone", () => {
    // MILESTONES repeat per 28-day cycle; INITIAL_BOOKINGS do not. Keeping the
    // psychology consult out of MILESTONES is what makes "just 1" true for a
    // comp12 client as well as a comp4 one.
    expect(INITIAL_BOOKINGS.some((b) => b.consultKind === "Psychologist")).toBe(true);
    expect(MILESTONES.some((m) => m.owner === "psychologist")).toBe(false);
  });

  it("is not on the PT or membership ladders", () => {
    for (const category of ["training", "membership", "blueprint"]) {
      const steps = onboardingRow({ ...base, category }).steps.filter((s) => /psychology/i.test(s.label));
      expect(steps, category).toHaveLength(0);
    }
  });

  it("is OPTIONAL — never due, never counted, never chased", () => {
    const row = onboardingRow(base);
    const psych = row.steps.find((s) => /psychology/i.test(s.label))!;
    expect(psych.optional).toBe(true);
    // The step exists but is not one of the things the client is owed, so an
    // untouched psychology consult must never hold onboarding open.
    expect(row.total).toBe(row.steps.filter((s) => !s.optional).length);
    expect(row.nextLabel).not.toMatch(/psychology/i);
  });

  it("lets onboarding complete without it", () => {
    const done = onboardingRow({
      ...base,
      bloodRequested: true,
      doctor: { scheduled: true, completed: true },
      diet: { scheduled: true, completed: true },
      trainer: { scheduled: true, completed: true },
      psych: { scheduled: false, completed: false },   // declined
      sessionScheduled: true,
    });
    expect(done.complete).toBe(true);
  });

  it("is the only optional step on the ladder", () => {
    const optional = onboardingRow(base).steps.filter((s) => s.optional);
    expect(optional.map((s) => s.label)).toEqual(["Book psychology consultation"]);
  });

  it("closes once it is booked", () => {
    const booked = onboardingRow({ ...base, psych: { scheduled: true, completed: false } }).steps
      .find((s) => /psychology/i.test(s.label))!;
    expect(booked.booked).toBe(true);
  });

  it("gives Comprehensive a psychologist on the care team", () => {
    expect(disciplinesForCategory("comprehensive")).toContain("psychologist");
    expect(disciplinesForCategory("training")).not.toContain("psychologist");
  });
});

// ---------------------------------------------------------------------------
// PT clients used to fall out of every queue: the follow-up generator was
// Comprehensive-only, so a training client's day-28 fitness reassessment lived
// in lib/pt.ts and appeared nowhere a human would look.
// ---------------------------------------------------------------------------
import { onProtocol, buildFollowupRows } from "@/lib/followups";
import { MILESTONES as PT_MILESTONES } from "@/lib/pt";
import { DISCIPLINE_KINDS, KIND_LABEL } from "@/lib/comprehensive";

describe("PT clients get a follow-up ladder", () => {
  const pt = { id: "p1", category: "training", start: "2026-08-01", joined: null, days: 28 };
  const comp = { id: "c1", category: "comprehensive", start: "2026-08-01", joined: null, days: 28 };

  it("counts training as being on a protocol", () => {
    expect(onProtocol(pt)).toBe(true);
    expect(onProtocol(comp)).toBe(true);
    expect(onProtocol({ ...pt, category: "membership" })).toBe(false);
  });

  it("generates the fitness reassessment for a PT client", () => {
    const rows = buildFollowupRows([pt], [], "test");
    expect(rows.map((r) => r.label)).toContain("Fitness reassessment");
    expect(PT_MILESTONES[0].label).toBe("Fitness reassessment");
  });

  it("does not give a PT client the diet-chart explanation — there is no chart", () => {
    const rows = buildFollowupRows([pt], [], "test");
    expect(rows.some((r) => /explanation/i.test(r.label))).toBe(false);
    // …but a Comprehensive client still gets it.
    expect(buildFollowupRows([comp], [], "test").some((r) => /explanation/i.test(r.label))).toBe(true);
  });

  it("does not give a PT client the diet and doctor milestones", () => {
    const labels = buildFollowupRows([pt], [], "test").map((r) => r.label);
    expect(labels).not.toContain("Day 10 diet follow-up");
    expect(labels).not.toContain("Day 28 doctor review");
  });
});

describe("the psychologist owes something", () => {
  it("has a summary sign-off gate like every other discipline", () => {
    expect(DISCIPLINE_KINDS).toContain("Psychologist");
    expect(KIND_LABEL.Psychologist).toBe("Psychologist");
  });
});

// ---------------------------------------------------------------------------
// The six coach markers raised nothing anywhere — not to the coach's queue, not
// to the manager, not to the Super Admin. The HAM-A self-harm referral band was
// among them.
// ---------------------------------------------------------------------------
import { MARKERS, markerOverdueDays, markerNeedsReferral, MARKER_KEYS } from "@/lib/coach-markers";
import { MARKER_BASELINE_GRACE_DAYS } from "@/lib/work-owners";

describe("coach markers", () => {
  const stress = MARKERS.find((m) => m.key === "stress")!;

  it("covers all six markers", () => {
    expect(MARKER_KEYS).toHaveLength(6);
    expect(MARKERS).toHaveLength(6);
  });

  it("is overdue once the cadence has elapsed", () => {
    const last = { marker: "stress" as const, date: "2026-08-01", tone: "good", band: "Low" };
    // reassessDays is 14 — 20 days later is 6 days overdue.
    expect(markerOverdueDays(stress, last, "2026-08-21")).toBe(6);
  });

  it("is not overdue inside the cadence", () => {
    const last = { marker: "stress" as const, date: "2026-08-01", tone: "good", band: "Low" };
    expect(markerOverdueDays(stress, last, "2026-08-10")).toBeNull();
  });

  it("treats a referral-band reading as urgent regardless of how recent it is", () => {
    // The number is the reason to act, not the calendar.
    expect(markerNeedsReferral({ marker: "anxiety" as const, date: "2026-08-21", tone: "bad", band: "Severe" })).toBe(true);
    expect(markerNeedsReferral({ marker: "anxiety" as const, date: "2026-08-21", tone: "good", band: "Mild" })).toBe(false);
    expect(markerNeedsReferral(undefined)).toBe(false);
  });

  it("gives a new client a grace window before chasing a missing baseline", () => {
    // Otherwise every new Comprehensive client lands on the coach's queue with
    // six red flags on day one, which teaches people to ignore the panel.
    expect(MARKER_BASELINE_GRACE_DAYS).toBeGreaterThan(0);
    expect(markerOverdueDays(stress, undefined, "2026-08-21", 0)).toBe(0);
    expect(markerOverdueDays(stress, undefined, "2026-08-21", 5)).toBe(5);
  });

  it("every marker names a referral threshold", () => {
    for (const m of MARKERS) {
      expect(m.referral, m.key).toBeTruthy();
      expect(m.reassessDays, m.key).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// The Chase button forgets on refresh — deliberately, because the work is still
// undone and the flag must stay. The ROW is where the memory lives.
// ---------------------------------------------------------------------------
import { chaseLabel, chaseFor, type ChaseIndex } from "@/lib/chase-log";

describe("chase history", () => {
  const NOW = Date.parse("2026-08-07T12:00:00Z");

  it("reads as plain English at each timescale", () => {
    expect(chaseLabel({ at: "2026-08-07T11:59:40Z", by: "Sini Antony", count: 1 }, NOW)).toBe("chased just now by Sini");
    expect(chaseLabel({ at: "2026-08-07T11:30:00Z", by: "Sini Antony", count: 1 }, NOW)).toBe("chased 30 min ago by Sini");
    expect(chaseLabel({ at: "2026-08-07T09:00:00Z", by: "Sini Antony", count: 1 }, NOW)).toBe("chased 3h ago by Sini");
    expect(chaseLabel({ at: "2026-08-05T12:00:00Z", by: "Sini Antony", count: 1 }, NOW)).toBe("chased 2d ago by Sini");
  });

  it("counts repeats, so a third chase is visibly a third chase", () => {
    expect(chaseLabel({ at: "2026-08-05T12:00:00Z", by: "Sini Antony", count: 2 }, NOW)).toMatch(/2nd time$/);
    expect(chaseLabel({ at: "2026-08-05T12:00:00Z", by: "Sini Antony", count: 4 }, NOW)).toMatch(/4th time$/);
  });

  it("survives a missing actor name", () => {
    expect(chaseLabel({ at: "2026-08-05T12:00:00Z", by: null, count: 1 }, NOW)).toBe("chased 2d ago");
  });

  it("matches on label+client, falling back to the bare label", () => {
    const idx: ChaseIndex = new Map([
      ["book doctor consultation|c1", { at: "2026-08-06T12:00:00Z", by: "Sini", count: 1 }],
      ["book diet consultation|", { at: "2026-08-06T12:00:00Z", by: "Sini", count: 1 }],
    ]);
    expect(chaseFor(idx, "Book doctor consultation", "c1")).not.toBeNull();
    expect(chaseFor(idx, "Book diet consultation", "c9")).not.toBeNull();  // bare-label fallback
    expect(chaseFor(idx, "Book fitness assessment", "c1")).toBeNull();
    expect(chaseFor(idx, undefined)).toBeNull();
  });
});
