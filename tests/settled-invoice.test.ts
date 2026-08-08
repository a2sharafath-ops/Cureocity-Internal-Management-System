import { describe, it, expect } from "vitest";
import { SETTLED_INVOICE } from "@/lib/work-owners";

// The client card treated Void / Cancelled / Refunded as settled; the front-desk
// dashboard only skipped "Paid". So an invoice raised for a package that was
// later voided disappeared from the client's card and went on nagging the front
// desk to collect it, with an overdue count that could never be cleared.
//
// One definition now, in work-owners.ts, imported by both.

describe("SETTLED_INVOICE", () => {
  it("counts every way an invoice can be finished with", () => {
    for (const s of ["Paid", "Void", "Cancelled", "Refunded"]) {
      expect(SETTLED_INVOICE.has(s), s).toBe(true);
    }
  });

  it("leaves genuinely outstanding invoices outstanding", () => {
    for (const s of ["Unpaid", "Overdue", "Draft", "Partial"]) {
      expect(SETTLED_INVOICE.has(s), s).toBe(false);
    }
  });

  it("is case-sensitive, matching the status values the app writes", () => {
    // Guard against someone "helpfully" lowercasing one side of the comparison
    // and quietly reopening every settled invoice.
    expect(SETTLED_INVOICE.has("paid")).toBe(false);
  });
});
