import { describe, it, expect } from "vitest";
import { buildFollowupRows, protocolStart } from "@/lib/followups";

// `planSharedAt` is set by default because the Day-2 explanation call only
// exists once the client can actually open their diet chart. Tests that care
// about the gate itself override it.
const comp = (over: Record<string, unknown> = {}) => ({
  id: "c1", joined: "2026-03-01", category: "comprehensive",
  start: "2026-06-01", days: 30, planSharedAt: "2026-06-01T09:00:00Z", ...over,
});

describe("buildFollowupRows — anchored to the package, not the join date", () => {
  it("dates every touchpoint from the package start", () => {
    const rows = buildFollowupRows([comp()], [], "test");
    const by = Object.fromEntries(rows.map((r) => [r.milestone_key, r.due_date]));
    expect(by["explain_2"]).toBe("2026-06-03");   // start + 2, NOT joined + 2
    expect(by["diet_10"]).toBe("2026-06-11");
    expect(by["diet_21"]).toBe("2026-06-22");
    expect(by["doctor_28"]).toBe("2026-06-29");
  });

  it("falls back to the join date when no package start is recorded", () => {
    expect(protocolStart(comp({ start: null }))).toBe("2026-03-01");
    const rows = buildFollowupRows([comp({ start: null, planSharedAt: "2026-03-01T09:00:00Z" })], [], "test");
    expect(rows.find((r) => r.milestone_key === "explain_2")?.due_date).toBe("2026-03-03");
  });

  it("queues nobody who is not on the comprehensive plan", () => {
    expect(buildFollowupRows([comp({ category: "blueprint" })], [], "test")).toHaveLength(0);
    expect(buildFollowupRows([comp({ category: null })], [], "test")).toHaveLength(0);
  });

  it("gives every row a milestone key, so upserts can dedupe", () => {
    const rows = buildFollowupRows([comp()], [{ client_id: "c1", renews_on: "2026-09-01" }], "test");
    expect(rows.every((r) => !!r.milestone_key)).toBe(true);
  });

  it("keeps ONE renewal row per client, whatever the cycle", () => {
    // Two cycles for the same client must collide on the key, not accumulate.
    const a = buildFollowupRows([], [{ client_id: "c1", renews_on: "2026-09-01" }], "test");
    const b = buildFollowupRows([], [{ client_id: "c1", renews_on: "2026-12-01" }], "test");
    expect(a[0].milestone_key).toBe("renewal");
    expect(b[0].milestone_key).toBe("renewal");
    expect(a[0].due_date).toBe("2026-08-25");     // 7 days before renewal
    expect(b[0].due_date).toBe("2026-11-24");
  });

  it("skips a client with no anchor date at all", () => {
    expect(buildFollowupRows([comp({ start: null, joined: null })], [], "test")).toHaveLength(0);
  });
});

describe("the Day-2 explanation waits for the chart to reach the client", () => {
  const keyOf = (c: Record<string, unknown>) =>
    buildFollowupRows([comp(c)], [], "test").find((r) => r.milestone_key === "explain_2");

  it("does not queue the call while no chart has been shared", () => {
    // It used to be dated from the package start alone, so the coach was asked
    // to walk someone through a document that did not exist yet — and the row
    // sat overdue while everyone waited on the dietitian.
    expect(keyOf({ planSharedAt: null })).toBeUndefined();
    expect(keyOf({ planSharedAt: undefined })).toBeUndefined();
  });

  it("keeps day 2 when the chart was shared early", () => {
    expect(keyOf({ planSharedAt: "2026-06-01T09:00:00Z" })?.due_date).toBe("2026-06-03");
  });

  it("moves the call to the share date when the chart was late", () => {
    // Shared on day 9 makes the call due on day 9 — not instantly nine days
    // overdue for a delay that was not the coach's.
    expect(keyOf({ planSharedAt: "2026-06-10T14:00:00Z" })?.due_date).toBe("2026-06-10");
  });

  it("never queues it for a PT client — there is no chart to explain", () => {
    expect(keyOf({ category: "training", planSharedAt: "2026-06-01T09:00:00Z" })).toBeUndefined();
  });
});
