import { describe, it, expect } from "vitest";
import { maskName, maskPhone, maskEmail, maskId, mask } from "@/lib/phi";

describe("PHI masking", () => {
  it("maskName keeps initials only", () => {
    expect(maskName("Alex Mercer")).toBe("A••• M•••••");
    expect(maskName(null)).toBe("—");
  });

  it("maskPhone shows only last 4 digits", () => {
    expect(maskPhone("+91 98765 43210")).toBe("••• ••• 3210");
    expect(maskPhone(null)).toBe("—");
  });

  it("maskEmail hides the local part but keeps domain", () => {
    expect(maskEmail("john@cureo.city")).toBe("j•••@cureo.city");
    expect(maskEmail(null)).toBe("—");
  });

  it("maskId shows last 4 chars", () => {
    expect(maskId("POL-123456789")).toBe("••••6789");
    expect(maskId("abc")).toBe("••••");
  });

  it("mask dispatches by kind", () => {
    expect(mask("Alex Mercer", "name")).toBe(maskName("Alex Mercer"));
    expect(mask("john@cureo.city", "email")).toBe(maskEmail("john@cureo.city"));
  });
});
