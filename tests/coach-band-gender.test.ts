import { describe, it, expect } from "vitest";
import { bandFor, markerNeedsReferral, MARKER_BY_KEY } from "@/lib/coach-markers";

// AUDIT-C is ≥4 for men and ≥3 for women. The substance marker's own referral
// text said exactly that; bandFor took no gender and applied the male cut-off to
// everyone. A woman scoring 3 was banded "Low risk", markerNeedsReferral stayed
// false, and the referral flag never fired.

describe("AUDIT-C banding", () => {
  it("bands a woman scoring 3 as positive", () => {
    const b = bandFor("substance", 3, "Female");
    expect(b?.tone).toBe("bad");
    expect(markerNeedsReferral({ tone: b!.tone } as Parameters<typeof markerNeedsReferral>[0])).toBe(true);
  });

  it("still bands a man scoring 3 as low risk", () => {
    expect(bandFor("substance", 3, "Male")?.tone).toBe("good");
  });

  it("bands anyone scoring 4 as positive", () => {
    expect(bandFor("substance", 4, "Male")?.tone).toBe("bad");
    expect(bandFor("substance", 4, "Female")?.tone).toBe("bad");
  });

  it("scores 0-2 stay low risk for everyone", () => {
    for (const g of ["Male", "Female", null]) {
      expect(bandFor("substance", 2, g)?.tone, String(g)).toBe("good");
    }
  });

  it("accepts the spellings gender is actually stored as", () => {
    for (const g of ["female", "F", "  Female  ", "woman"]) {
      expect(bandFor("substance", 3, g)?.tone, g).toBe("bad");
    }
  });

  it("falls back to the male threshold when gender is unknown", () => {
    // Not ideal clinically, but it is the documented default and it is better
    // than guessing. Recording gender is the fix.
    expect(bandFor("substance", 3, null)?.tone).toBe("good");
    expect(bandFor("substance", 3)?.tone).toBe("good");
  });

  it("leaves the other markers alone", () => {
    // Only AUDIT-C has a sex-specific cut-off in the SOP.
    for (const key of ["sleep", "activity", "nutrition", "anxiety"] as const) {
      if (!MARKER_BY_KEY[key]) continue;
      expect(bandFor(key, 1, "Female")).toEqual(bandFor(key, 1, "Male"));
    }
  });
});
