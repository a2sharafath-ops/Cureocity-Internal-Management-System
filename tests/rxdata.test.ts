import { describe, it, expect } from "vitest";
import { screenInteractions, screenAllergies, screenAll } from "@/lib/rxdata";

describe("screenInteractions", () => {
  it("flags warfarin + aspirin as severe", () => {
    const flags = screenInteractions(["Warfarin 5mg", "Aspirin 75mg"]);
    expect(flags.length).toBeGreaterThan(0);
    expect(flags[0].severity).toBe("severe");
  });

  it("is case-insensitive and substring-based", () => {
    expect(screenInteractions(["SIMVASTATIN", "clarithromycin 500"]).length).toBeGreaterThan(0);
  });

  it("returns nothing for an unrelated pair", () => {
    expect(screenInteractions(["Paracetamol", "Vitamin C"]).length).toBe(0);
  });

  it("needs two drugs to interact", () => {
    expect(screenInteractions(["Warfarin"]).length).toBe(0);
  });
});

describe("screenAllergies", () => {
  it("flags a drug the patient is allergic to", () => {
    const flags = screenAllergies(["Amoxicillin"], ["amoxicillin"]);
    expect(flags.length).toBe(1);
    expect(flags[0].severity).toBe("severe");
  });

  it("does not flag unrelated substances", () => {
    expect(screenAllergies(["Metformin"], ["penicillin"]).length).toBe(0);
  });
});

describe("screenAll", () => {
  it("combines allergy and interaction flags", () => {
    const flags = screenAll(["Warfarin", "Aspirin"], ["aspirin"]);
    // one allergy (aspirin) + one interaction (warfarin+aspirin)
    expect(flags.length).toBeGreaterThanOrEqual(2);
  });
});
