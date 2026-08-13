import { describe, expect, it } from "vitest";
import { buildStrengthSessions } from "@/lib/strength-sessions";

describe("strength-session cohorts", () => {
  it("uses Monday, Wednesday, Friday for a Monday start", () => {
    expect(buildStrengthSessions("client", "trainer", 10, "2026-08-10", 6).map((x) => x.date)).toEqual(["2026-08-10", "2026-08-12", "2026-08-14", "2026-08-17", "2026-08-19", "2026-08-21"]);
  });
  it("uses Tuesday, Thursday, Saturday for a Thursday start", () => {
    expect(buildStrengthSessions("client", "trainer", 10, "2026-08-13", 6).map((x) => x.date)).toEqual(["2026-08-13", "2026-08-15", "2026-08-18", "2026-08-20", "2026-08-22", "2026-08-25"]);
  });
  it("rejects Sunday", () => {
    expect(() => buildStrengthSessions("client", "trainer", 10, "2026-08-16", 12)).toThrow(/Sunday/);
  });
});
