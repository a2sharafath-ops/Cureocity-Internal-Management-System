import { describe, expect, it } from "vitest";
import { buildStrengthSessions } from "@/lib/strength-sessions";

describe("bulk strength-block reschedule", () => {
  it("rebuilds all 12 sessions in the newly selected cohort", () => {
    const rows = buildStrengthSessions("client", "trainer", 10, "2026-08-13", 12);
    expect(rows).toHaveLength(12);
    expect(rows.slice(0, 4).map((row) => row.date)).toEqual(["2026-08-13", "2026-08-15", "2026-08-18", "2026-08-20"]);
    expect(rows.every((row) => row.hour === 10)).toBe(true);
  });
});
