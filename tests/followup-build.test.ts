import { describe, it, expect } from "vitest";
import { buildFollowupRows, protocolStart } from "@/lib/followups";

const comp = (over: Record<string, unknown> = {}) => ({
  id: "c1", joined: "2026-03-01", category: "comprehensive",
  start: "2026-06-01", days: 30, ...over,
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
    const rows = buildFollowupRows([comp({ start: null })], [], "test");
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
