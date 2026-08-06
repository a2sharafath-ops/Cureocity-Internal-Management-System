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
