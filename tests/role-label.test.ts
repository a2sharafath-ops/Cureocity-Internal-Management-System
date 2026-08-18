import { describe, expect, it } from "vitest";
import { roleLabel } from "@/lib/roles";
import { nativeRoleOptionLabel } from "@/lib/role-preview";

describe("staff-facing role labels", () => {
  it("calls the internal Administrator role Admin without changing its value", () => {
    expect(roleLabel("Administrator")).toBe("Admin");
    expect(roleLabel("Super Admin")).toBe("Super Admin");
    expect(roleLabel("Manager")).toBe("Manager");
  });

  it("uses the Admin label in the role-preview control", () => {
    expect(nativeRoleOptionLabel("Administrator", false)).toBe("View as… (Admin)");
    expect(nativeRoleOptionLabel("Administrator", true)).toBe("Return to Admin");
  });
});
