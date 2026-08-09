import { describe, it, expect, vi } from "vitest";
import { resolvableGates, closeResolvedGates } from "@/lib/cron/sla-resolve";

describe("resolvableGates", () => {
  it("retires an alert whose work is now done", () => {
    // The reason this exists: the ledger only ever grew, so a diet chart
    // written an hour late stayed red on the Whiteboard for the rest of the
    // package and the coach re-explained it every single day.
    const existing = [{ client_id: "c1", gate: "diet_draft" }];
    expect(resolvableGates(existing, [])).toEqual([{ client_id: "c1", gate: "diet_draft" }]);
  });

  it("leaves an alert alone while the work is still late", () => {
    const existing = [{ client_id: "c1", gate: "diet_draft" }];
    expect(resolvableGates(existing, [{ client_id: "c1", gate: "diet_draft" }])).toEqual([]);
  });

  it("keeps clients apart — one being caught up says nothing about another", () => {
    const existing = [
      { client_id: "c1", gate: "diet_draft" },
      { client_id: "c2", gate: "diet_draft" },
    ];
    expect(resolvableGates(existing, [{ client_id: "c2", gate: "diet_draft" }]))
      .toEqual([{ client_id: "c1", gate: "diet_draft" }]);
  });

  it("closes the warning and the breach together", () => {
    // A gate that warned and then breached has two rows for one piece of work.
    // Closing one and leaving the other leaves half an alert on the board.
    const existing = [
      { client_id: "c1", gate: "signoff:Doctor" },
      { client_id: "c1", gate: "signoff:Doctor" },
    ];
    expect(resolvableGates(existing, [])).toEqual([{ client_id: "c1", gate: "signoff:Doctor" }]);
  });

  it("does nothing when the ledger is empty", () => {
    expect(resolvableGates([], [{ client_id: "c1", gate: "x" }])).toEqual([]);
  });
});

describe("closeResolvedGates", () => {
  it("issues one update per client, not one per alert", () => {
    const inCall = vi.fn(async () => ({}));
    const eq = vi.fn(() => ({ in: inCall }));
    const is = vi.fn(() => ({ eq }));
    const update = vi.fn(() => ({ is }));
    const supabase = { from: vi.fn(() => ({ update })) };

    return closeResolvedGates(supabase as never, [
      { client_id: "c1", gate: "a" },
      { client_id: "c1", gate: "b" },
      { client_id: "c2", gate: "a" },
    ], "2026-08-09T00:00:00Z").then((n) => {
      expect(n).toBe(3);
      expect(update).toHaveBeenCalledTimes(2);
      expect(inCall).toHaveBeenCalledWith("gate", ["a", "b"]);
      expect(is).toHaveBeenCalledWith("resolved_at", null);
    });
  });

  it("does nothing at all when there is nothing to retire", async () => {
    const supabase = { from: vi.fn() };
    expect(await closeResolvedGates(supabase as never, [])).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
