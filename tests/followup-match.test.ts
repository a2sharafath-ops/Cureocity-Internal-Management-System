import { describe, it, expect } from "vitest";
import { followupMatchesAppointment, apptTypeForFollowup } from "@/lib/followups";

const fu = (label: string, category: string | null = null) => ({ label, category });

describe("apptTypeForFollowup", () => {
  it("books the owning discipline's real service, not 'Follow-up'", () => {
    expect(apptTypeForFollowup(fu("Day 10 diet follow-up", "Diet Consultation"))).toBe("Diet Consultation");
    expect(apptTypeForFollowup(fu("Day 21 diet review", "Diet Consultation"))).toBe("Diet Consultation");
    expect(apptTypeForFollowup(fu("Day 28 doctor follow-up", "Doctor Consultation"))).toBe("Doctor Consultation");
    expect(apptTypeForFollowup(fu("Day 2 diet chart explanation", "Diet Consultation"))).toBe("Diet Chart Explanation");
  });
  it("leaves a renewal call as a plain follow-up", () => {
    expect(apptTypeForFollowup(fu("Renewal due (2026-09-01)", "Renewal"))).toBe("Follow-up");
  });
});

describe("followupMatchesAppointment", () => {
  it("closes a diet follow-up when a diet appointment is booked", () => {
    expect(followupMatchesAppointment(fu("Day 10 diet follow-up", "Diet Consultation"), "Diet Consultation")).toBe(true);
    expect(followupMatchesAppointment(fu("Day 21 diet review", "Diet Consultation"), "Diet Consultation")).toBe(true);
  });
  it("does not close a diet follow-up with a doctor appointment", () => {
    expect(followupMatchesAppointment(fu("Day 10 diet follow-up", "Diet Consultation"), "Doctor Consultation")).toBe(false);
  });
  it("keeps the Day-2 explanation distinct from other diet visits", () => {
    // Booking a normal diet consultation must not tick off the chart explanation.
    expect(followupMatchesAppointment(fu("Day 2 diet chart explanation", "Diet Consultation"), "Diet Consultation")).toBe(false);
    expect(followupMatchesAppointment(fu("Day 2 diet chart explanation", "Diet Consultation"), "Diet Chart Explanation")).toBe(true);
  });
  it("matches fitness reassessment against fitness services", () => {
    expect(followupMatchesAppointment(fu("Fitness reassessment", null), "Fitness Services")).toBe(true);
  });
  it("never matches an empty or renewal row", () => {
    expect(followupMatchesAppointment(fu("Renewal due (2026-09-01)", "Renewal"), "Diet Consultation")).toBe(false);
    expect(followupMatchesAppointment(fu("Day 10 diet follow-up", "Diet Consultation"), "")).toBe(false);
  });
});
