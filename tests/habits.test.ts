import { describe, it, expect } from "vitest";
import { currentStreak, last7Count } from "@/lib/habits";

const T = "2026-07-17";

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(currentStreak(["2026-07-15", "2026-07-16", "2026-07-17"], T)).toBe(3);
  });

  it("stays alive if today not logged but yesterday was", () => {
    expect(currentStreak(["2026-07-15", "2026-07-16"], T)).toBe(2);
  });

  it("is zero when the most recent day is 2+ days ago", () => {
    expect(currentStreak(["2026-07-14", "2026-07-15"], T)).toBe(0);
  });

  it("breaks on a gap", () => {
    expect(currentStreak(["2026-07-13", "2026-07-15", "2026-07-16", "2026-07-17"], T)).toBe(3);
  });

  it("empty set is zero", () => {
    expect(currentStreak([], T)).toBe(0);
  });
});

describe("last7Count", () => {
  it("counts done days within the last 7 including today", () => {
    expect(last7Count(["2026-07-17", "2026-07-16", "2026-07-11", "2026-07-10"], T)).toBe(3);
  });

  it("ignores days older than 7", () => {
    expect(last7Count(["2026-07-01"], T)).toBe(0);
  });
});
