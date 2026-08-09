import { describe, it, expect } from "vitest";
import { currentTerm } from "@/lib/obligations";

const TODAY = "2026-08-09";
const pkg = (category: string, start: string, end: string | null = null) =>
  ({ category, start_date: start, end_date: end });

describe("currentTerm — which package a client is actually on", () => {
  it("returns nothing when there is no active package", () => {
    expect(currentTerm([], [], TODAY)).toBeNull();
  });

  it("ignores a package with no start date — that is a data problem, not a schedule", () => {
    expect(currentTerm([{ category: "comprehensive", start_date: null, end_date: null }], [], TODAY)).toBeNull();
  });

  it("takes the care package over a gym membership", () => {
    // A membership never governs care, whichever order the rows arrive in.
    const t = currentTerm([pkg("membership", "2026-01-01"), pkg("comprehensive", "2026-07-15")], [], TODAY);
    expect(t?.category).toBe("comprehensive");
    expect(t?.anchor).toBe("2026-07-15");
  });

  it("takes the richest care package when several are held", () => {
    expect(currentTerm([pkg("training", "2026-07-01"), pkg("blueprint", "2026-07-01")], [], TODAY)?.category).toBe("blueprint");
  });

  it("is not fooled by capitalisation", () => {
    expect(currentTerm([pkg("Comprehensive", "2026-07-15")], [], TODAY)?.category).toBe("comprehensive");
  });
});

describe("a renewed client", () => {
  // Renewing adds a second active package and leaves the first one active.
  // Every engine used to pick one for itself and they picked differently: the
  // client card errored and fell back to a package date, the dashboard kept
  // whichever row came back last, and Today's agenda listed BOTH terms.
  const old = pkg("comprehensive", "2026-04-01", "2026-06-30");
  const now = pkg("comprehensive", "2026-07-01", "2026-09-30");

  it("is measured against the term covering today, not the expired one", () => {
    expect(currentTerm([old, now], [], TODAY)?.anchor).toBe("2026-07-01");
    expect(currentTerm([now, old], [], TODAY)?.anchor).toBe("2026-07-01");
  });

  it("gives the same answer whichever order the rows arrive in", () => {
    expect(currentTerm([old, now], [], TODAY)).toEqual(currentTerm([now, old], [], TODAY));
  });

  it("keeps the last term once everything has expired", () => {
    // A lapsed client is still measured against the work that was last owed,
    // rather than dropping off every board entirely.
    expect(currentTerm([old], [], "2026-08-09")?.anchor).toBe("2026-04-01");
  });

  it("uses the term the client is in, not the one starting next month", () => {
    const future = pkg("comprehensive", "2026-09-01", "2026-11-30");
    expect(currentTerm([now, future], [], TODAY)?.anchor).toBe("2026-07-01");
  });
});

describe("how long the term runs", () => {
  it("reads the length from the package's own end date", () => {
    // comp12 = 84 days = three diet cycles; comp4 = 28 = one.
    expect(currentTerm([pkg("comprehensive", "2026-07-01", "2026-09-23")], [], TODAY)?.spanDays).toBe(84);
  });

  it("assumes a single cycle when no end date is recorded", () => {
    expect(currentTerm([pkg("comprehensive", "2026-07-01")], [], TODAY)?.spanDays).toBe(28);
  });

  it("never goes below one cycle, however short the package", () => {
    expect(currentTerm([pkg("comprehensive", "2026-08-01", "2026-08-05")], [], TODAY)?.spanDays).toBe(28);
  });
});

describe("the care-protocol row wins where there is one", () => {
  it("anchors on the protocol start, not the package start", () => {
    const t = currentTerm([pkg("comprehensive", "2026-07-05")], [{ protocol: "comprehensive", start_date: "2026-07-01" }], TODAY);
    expect(t?.anchor).toBe("2026-07-01");
  });

  it("ignores a protocol row belonging to a different package", () => {
    // A PT protocol must not re-date a Comprehensive client's milestones.
    const t = currentTerm([pkg("comprehensive", "2026-07-05")], [{ protocol: "training", start_date: "2026-01-01" }], TODAY);
    expect(t?.anchor).toBe("2026-07-05");
  });

  it("does not let a renewal's protocol row re-anchor the term in progress", () => {
    const t = currentTerm(
      [pkg("comprehensive", "2026-07-01", "2026-09-30")],
      [{ protocol: "comprehensive", start_date: "2026-06-28" }, { protocol: "comprehensive", start_date: "2026-10-01" }],
      TODAY,
    );
    expect(t?.anchor).toBe("2026-06-28");
  });

  it("gives the same answer whichever order the protocol rows arrive in", () => {
    const a = [{ protocol: "comprehensive", start_date: "2026-06-28" }, { protocol: "comprehensive", start_date: "2026-04-01" }];
    const p = [pkg("comprehensive", "2026-07-01")];
    expect(currentTerm(p, a, TODAY)).toEqual(currentTerm(p, [...a].reverse(), TODAY));
  });

  it("accepts a protocol row that names no package, for older data", () => {
    const t = currentTerm([pkg("comprehensive", "2026-07-05")], [{ start_date: "2026-07-01" }], TODAY);
    expect(t?.anchor).toBe("2026-07-01");
  });
});
