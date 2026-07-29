import { describe, it, expect } from "vitest";
import {
  makeCatOf, isInitialApptType, serviceForMilestone, milestoneSatisfied, milestoneBookHref,
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
  const base = { category: "Diet Consultation", fromDate: "2026-08-05", service: "10th Day Diet Followup", catOf };

  it("counts a service-named booking regardless of date (early booking)", () => {
    const appts = [{ type: "10th Day Diet Followup", date: "2026-07-29", status: "scheduled" }];
    expect(milestoneSatisfied(appts, base)).toBe(true);
  });
  it("counts a legacy category booking within the date window", () => {
    const appts = [{ type: "Diet Consultation", date: "2026-08-06", status: "completed" }];
    expect(milestoneSatisfied(appts, base)).toBe(true);
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
