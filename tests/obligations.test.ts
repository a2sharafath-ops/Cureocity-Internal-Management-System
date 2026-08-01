import { describe, it, expect } from "vitest";
import { buildOwnerResolver, outstandingDeliverables, ROLE_TO_DISC, type AssignRow, type ApptOwnerRow } from "@/lib/obligations";

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
