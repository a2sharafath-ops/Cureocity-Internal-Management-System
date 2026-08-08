import { describe, it, expect } from "vitest";
import { clientStatus, type StatusInput } from "@/lib/client-status";

// The badge used to say "Ready to start · Fri 11am" for ANY booking. Two things
// wrong with that: it read as "go now" when the appointment was a fortnight
// away, and it kept saying it for ever once the day passed and nobody held the
// consult — a no-show looked exactly like an upcoming appointment.

const TODAY = "2026-08-10";

const input = (doctor: Partial<StatusInput["consults"]["doctor"]>, extra: Partial<StatusInput> = {}): StatusInput => ({
  category: "comprehensive",
  membershipActive: false,
  frozen: false,
  onboardComplete: false,
  onboardNext: null,
  bloodRequested: false,
  bloodSubmitted: false,
  journeySteps: [],
  today: TODAY,
  consults: {
    doctor: { booked: false, completed: false, when: null, date: null, dueDate: null, ...doctor },
    dietitian: { booked: false, completed: false, when: null, date: null, dueDate: null },
    trainer: { booked: false, completed: false, when: null, date: null, dueDate: null },
    coach: { booked: false, completed: false, when: null, date: null, dueDate: null },
    psychologist: { booked: false, completed: false, when: null, date: null, dueDate: null },
  },
  ...extra,
});

describe("clinician badge", () => {
  it("says done when it's done", () => {
    const s = clientStatus(input({ completed: true }), "doctor");
    expect(s.label).toContain("consult done");
    expect(s.tone).toBe("good");
  });

  it("'Ready to start' ONLY when the booking is today", () => {
    const s = clientStatus(input({ booked: true, date: TODAY, when: "Mon 11am" }), "doctor");
    expect(s.label).toContain("Ready to start");
    expect(s.tone).toBe("action");
  });

  it("a future booking says Booked with a real date, not a bare weekday", () => {
    const s = clientStatus(input({ booked: true, date: "2026-08-14", when: "Fri 11am" }), "doctor");
    expect(s.label).toContain("Booked");
    expect(s.label).toContain("14 Aug");
    expect(s.label).not.toContain("Ready to start");
  });

  it("a booking whose day has passed reads as Missed — the old bug", () => {
    const s = clientStatus(input({ booked: true, date: "2026-08-07", when: "Fri 11am" }), "doctor");
    expect(s.label).toContain("Missed");
    expect(s.label).toContain("7 Aug");
    expect(s.tone).toBe("warn");
  });

  it("nothing booked and past due reads as Overdue", () => {
    const s = clientStatus(input({ dueDate: "2026-08-05" }), "doctor");
    expect(s.label).toContain("Overdue");
    expect(s.label).toContain("5 Aug");
    expect(s.tone).toBe("warn");
  });

  it("nothing booked but not yet due shows the deadline without alarm", () => {
    const s = clientStatus(input({ dueDate: "2026-08-20" }), "doctor");
    expect(s.label).toContain("Awaiting booking");
    expect(s.label).toContain("20 Aug");
    expect(s.tone).toBe("neutral");
  });

  it("a booking with no date can only say Booked", () => {
    // A consultation row with no matching appointment — honest rather than
    // inventing a time.
    const s = clientStatus(input({ booked: true }), "doctor");
    expect(s.label).toBe("Booked");
  });

  it("blood still takes precedence over a plain awaiting-booking", () => {
    const s = clientStatus(input({}, { bloodRequested: true, bloodSubmitted: false }), "doctor");
    expect(s.label).toBe("Awaiting blood report");
  });

  it("but an overdue consult outranks the blood message", () => {
    // If the consult itself is late, that is the more urgent fact.
    const s = clientStatus(input({ dueDate: "2026-08-01" }, { bloodRequested: true, bloodSubmitted: false }), "doctor");
    expect(s.label).toContain("Overdue");
  });
});
