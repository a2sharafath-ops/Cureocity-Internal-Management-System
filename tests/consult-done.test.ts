import { describe, it, expect } from "vitest";
import { consultDoneKinds, outstandingDeliverables } from "@/lib/obligations";
import { makeCatOf } from "@/lib/appt-match";

const catOf = makeCatOf([
  { name: "Initial Diet Consultation", category: "Diet Consultation" },
  { name: "10th Day Diet Followup", category: "Diet Consultation" },
  { name: "Initial Fitness Consultation", category: "Fitness Services" },
  { name: "Initial Doctor Consultation", category: "Doctor Consultation" },
]);

describe("consultDoneKinds", () => {
  it("counts a completed consultation record", () => {
    expect([...consultDoneKinds([{ kind: "Diet", status: "completed" }])]).toEqual(["Diet"]);
  });

  it("ignores one that is only scheduled or cancelled", () => {
    expect(consultDoneKinds([
      { kind: "Diet", status: "scheduled" },
      { kind: "Doctor", status: "cancelled" },
    ]).size).toBe(0);
  });

  it("counts a completed appointment by the provider's role", () => {
    // The reason this exists: the dietitian holds the session and Front Desk
    // marks the diary. No consultations row is ever written, and the diet chart
    // was never owed — silently, with no screen saying anything was missing.
    const done = consultDoneKinds([], [
      { type: "Initial Diet Consultation", status: "completed", staff: { role: "Dietitian" } },
    ], catOf);
    expect(done.has("Diet")).toBe(true);
  });

  it("falls back to the service's category when no provider is named", () => {
    const done = consultDoneKinds([], [
      { type: "Initial Fitness Consultation", status: "completed", staff: null },
    ], catOf);
    expect(done.has("Trainer")).toBe(true);
  });

  it("reads a bare category too — older rows store the category itself", () => {
    expect(consultDoneKinds([], [{ type: "Doctor Consultation", status: "completed" }], catOf).has("Doctor")).toBe(true);
  });

  it("does not count an appointment that has not been held", () => {
    for (const status of ["scheduled", "no_show", "cancelled"]) {
      const done = consultDoneKinds([], [
        { type: "Initial Diet Consultation", status, staff: { role: "Dietitian" } },
      ], catOf);
      expect(done.size, status).toBe(0);
    }
  });

  it("degrades safely with no category resolver rather than guessing wrong", () => {
    // Without the catalogue a service NAME can't be resolved — better to miss it
    // than to file it under the wrong discipline.
    const done = consultDoneKinds([], [{ type: "Initial Diet Consultation", status: "completed" }]);
    expect(done.size).toBe(0);
    // A bare category still works, because it needs no lookup.
    expect(consultDoneKinds([], [{ type: "Diet Consultation", status: "completed" }]).has("Diet")).toBe(true);
  });

  it("does not double-count the same discipline recorded both ways", () => {
    const done = consultDoneKinds(
      [{ kind: "Diet", status: "completed" }],
      [{ type: "Initial Diet Consultation", status: "completed", staff: { role: "Dietitian" } }],
      catOf,
    );
    expect([...done]).toEqual(["Diet"]);
  });

  it("keeps the disciplines apart", () => {
    const done = consultDoneKinds([], [
      { type: "x", status: "completed", staff: { role: "Health Coach" } },
      { type: "y", status: "completed", staff: { role: "Psychologist" } },
    ], catOf);
    expect(done.has("Coach")).toBe(true);
    expect(done.has("Psychologist")).toBe(true);
    expect(done.has("Diet")).toBe(false);
  });
});

describe("the deliverable that used to go missing", () => {
  const base = { isComp: true, isPt: false, hasChart: false, hasWorkout: false, compBloodSubmitted: true };

  it("owes a diet chart when the consult exists only as a completed appointment", () => {
    const done = consultDoneKinds([], [
      { type: "Initial Diet Consultation", status: "completed", staff: { role: "Dietitian" } },
    ], catOf);
    const out = outstandingDeliverables({
      ...base,
      dietConsultDone: done.has("Diet"),
      trainerConsultDone: done.has("Trainer"),
    });
    expect(out).toContain("dietchart");
  });

  it("owes a workout plan on the same evidence", () => {
    const done = consultDoneKinds([], [
      { type: "Initial Fitness Consultation", status: "completed", staff: { role: "Fitness Trainer" } },
    ], catOf);
    const out = outstandingDeliverables({
      ...base, isPt: true, dietConsultDone: false, trainerConsultDone: done.has("Trainer"),
    });
    expect(out).toContain("workout");
  });

  it("owes nothing before the consult has happened", () => {
    const done = consultDoneKinds([], [
      { type: "Initial Diet Consultation", status: "scheduled", staff: { role: "Dietitian" } },
    ], catOf);
    expect(outstandingDeliverables({
      ...base, dietConsultDone: done.has("Diet"), trainerConsultDone: done.has("Trainer"),
    })).toEqual([]);
  });

  it("stops owing it once the chart exists", () => {
    const done = consultDoneKinds([{ kind: "Diet", status: "completed" }]);
    expect(outstandingDeliverables({
      ...base, hasChart: true, dietConsultDone: done.has("Diet"), trainerConsultDone: false,
    })).toEqual([]);
  });
});
