import { describe, it, expect } from "vitest";
import { governingPackage, PACKAGE_PRIORITY, onProtocol } from "@/lib/followups";

// Both follow-up generators used to key a Map by client id straight from the
// query, so whichever active package Postgres returned LAST won. A Comprehensive
// client who also holds a gym membership could resolve to "membership",
// onProtocol() returned false, and they got no follow-ups at all — no day-2
// explanation, no day-10/21/28 calls. Non-deterministic between runs, and
// completely silent.

const cp = (category: string) => ({ category, start_date: "2026-08-01", end_date: null });

describe("governingPackage", () => {
  it("prefers the care package over a facility membership, whatever the order", () => {
    expect(governingPackage([cp("membership"), cp("comprehensive")])?.category).toBe("comprehensive");
    expect(governingPackage([cp("comprehensive"), cp("membership")])?.category).toBe("comprehensive");
  });

  it("ranks blueprint above comprehensive above training above membership", () => {
    expect(governingPackage([cp("training"), cp("blueprint"), cp("comprehensive")])?.category).toBe("blueprint");
    expect(governingPackage([cp("membership"), cp("training")])?.category).toBe("training");
  });

  it("is case-insensitive — categories are free text in the DB", () => {
    expect(governingPackage([cp("membership"), cp("Comprehensive")])?.category).toBe("Comprehensive");
  });

  it("falls back to the first row for a category nobody has ranked", () => {
    expect(governingPackage([cp("workshop"), cp("retreat")])?.category).toBe("workshop");
  });

  it("returns null when the client holds nothing active", () => {
    expect(governingPackage([])).toBeNull();
  });

  it("keeps the client on their protocol — the actual regression", () => {
    const held = [cp("membership"), cp("comprehensive")];
    const winner = governingPackage(held)!;
    expect(onProtocol({ category: winner.category } as Parameters<typeof onProtocol>[0])).toBe(true);
    // ...whereas the losing row would have taken them off it entirely.
    expect(onProtocol({ category: "membership" } as Parameters<typeof onProtocol>[0])).toBe(false);
  });

  it("the priority list matches the one in client-status.ts", () => {
    // Two engines, one order. If these ever diverge, a client's card and their
    // follow-up ladder start describing different packages.
    expect(PACKAGE_PRIORITY).toEqual(["blueprint", "comprehensive", "training", "membership"]);
  });
});
