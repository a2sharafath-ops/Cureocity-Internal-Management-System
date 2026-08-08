import { describe, it, expect } from "vitest";

// The portal's "I've submitted my report" button used to close EVERY open blood
// request for the client, because the update filtered on client_id alone. A
// client can hold a BluePrint panel and a Comprehensive panel at the same time,
// so one tap cleared an obligation with no report against it.
//
// The action now resolves a single panel first. This is the selection rule,
// extracted so it can be checked without a database.

type Req = { panel: string | null; submitted: boolean; requested_at: string | null };

/** The panel a portal submission should close: the oldest still-open one. */
export function panelToClose(rows: Req[]): string | null {
  const open = rows
    .filter((r) => !r.submitted && r.panel)
    .sort((a, b) => (a.requested_at ?? "").localeCompare(b.requested_at ?? ""));
  return open.length ? open[0].panel : null;
}

describe("panelToClose", () => {
  it("closes the older panel when two are outstanding", () => {
    expect(panelToClose([
      { panel: "comprehensive", submitted: false, requested_at: "2026-08-01" },
      { panel: "blueprint", submitted: false, requested_at: "2026-07-01" },
    ])).toBe("blueprint");
  });

  it("skips a panel that is already submitted", () => {
    expect(panelToClose([
      { panel: "blueprint", submitted: true, requested_at: "2026-07-01" },
      { panel: "comprehensive", submitted: false, requested_at: "2026-08-01" },
    ])).toBe("comprehensive");
  });

  it("returns null when nothing is outstanding, so the action no-ops", () => {
    // Important: previously this case still stamped submitted_date over an
    // already-closed request.
    expect(panelToClose([
      { panel: "blueprint", submitted: true, requested_at: "2026-07-01" },
    ])).toBeNull();
  });

  it("returns null on an empty list", () => {
    expect(panelToClose([])).toBeNull();
  });

  it("ignores a request with no panel recorded", () => {
    expect(panelToClose([{ panel: null, submitted: false, requested_at: "2026-07-01" }])).toBeNull();
  });

  it("treats a missing requested_at as oldest, so it is not stranded", () => {
    expect(panelToClose([
      { panel: "comprehensive", submitted: false, requested_at: "2026-08-01" },
      { panel: "blueprint", submitted: false, requested_at: null },
    ])).toBe("blueprint");
  });
});
