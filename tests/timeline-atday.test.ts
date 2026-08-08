import { describe, it, expect } from "vitest";
import { atDay, buildTimeline } from "@/lib/timeline";

// Consultations never appeared on a client's Journey timeline. atDay appended
// "T12:00:00Z" to whatever it was given; `consultations.created_at` is a full
// timestamp, so the result was "…+00:00T12:00:00Z", Date.parse said NaN, and
// buildTimeline dropped the row without a word. Every other source column is
// date-only, which is why only consultations went missing.

describe("atDay", () => {
  it("handles a date-only column", () => {
    expect(atDay("2026-08-07")).toBe("2026-08-07T12:00:00Z");
  });

  it("handles a full timestamptz — the case that was broken", () => {
    expect(atDay("2026-08-07T04:41:15.218496+00:00")).toBe("2026-08-07T12:00:00Z");
  });

  it("handles a plain ISO timestamp", () => {
    expect(atDay("2026-08-07T04:41:15Z")).toBe("2026-08-07T12:00:00Z");
  });

  it("returns null for null / empty", () => {
    expect(atDay(null)).toBeNull();
    expect(atDay(undefined)).toBeNull();
    expect(atDay("")).toBeNull();
  });

  it("returns null for something that isn't a date at all", () => {
    expect(atDay("not a date")).toBeNull();
    expect(atDay("07/08/2026")).toBeNull();
  });

  it("always produces something Date.parse accepts", () => {
    for (const d of ["2026-08-07", "2026-08-07T04:41:15.218496+00:00", "2026-12-31T23:59:59Z"]) {
      expect(Number.isFinite(Date.parse(atDay(d)!)), d).toBe(true);
    }
  });
});

describe("buildTimeline", () => {
  it("keeps an event whose date came from a timestamp column", () => {
    const events = buildTimeline([[
      { at: atDay("2026-08-07T04:41:15.218496+00:00") ?? "", kind: "consultation", title: "Doctor consultation", detail: "completed" },
    ]]);
    expect(events).toHaveLength(1);
  });

  it("still drops a genuinely unparseable event rather than crashing", () => {
    const events = buildTimeline([[
      { at: "rubbish", kind: "note", title: "x" },
      { at: atDay("2026-08-07") ?? "", kind: "note", title: "y" },
    ]]);
    expect(events.map((e) => e.title)).toEqual(["y"]);
  });

  it("sorts newest first", () => {
    const events = buildTimeline([[
      { at: atDay("2026-08-01") ?? "", kind: "note", title: "older" },
      { at: atDay("2026-08-07T04:41:15+00:00") ?? "", kind: "consultation", title: "newer" },
    ]]);
    expect(events.map((e) => e.title)).toEqual(["newer", "older"]);
  });
});
