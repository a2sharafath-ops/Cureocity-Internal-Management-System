import { describe, expect, it } from "vitest";
import {
  isNativeSuperAdmin,
  nativeRoleOptionLabel,
  previewSelectionDestination,
  resolveViewRole,
  shouldShowWorkspaceNavigation,
} from "@/lib/role-preview";

describe("role preview navigation", () => {
  it("keeps the real Super Admin role native until an explicit preview is active", () => {
    expect(resolveViewRole("Super Admin", null, null)).toEqual({
      real: "Super Admin",
      effective: "Super Admin",
      preview: null,
      profession: null,
    });
    expect(resolveViewRole("Super Admin", "Medical Director", null)).toMatchObject({
      real: "Super Admin",
      effective: "Medical Director",
      preview: "Medical Director",
      profession: null,
    });
    expect(resolveViewRole("Super Admin", "Dietitian", "Dietitian")).toMatchObject({
      effective: "Dietitian",
      preview: "Dietitian",
      profession: "Dietitian",
    });
  });

  it("ignores preview cookies for non-admin staff and mismatched stale profession state", () => {
    expect(resolveViewRole("Doctor", "Dietitian", "Dietitian")).toMatchObject({
      effective: "Doctor",
      preview: null,
      profession: null,
    });
    expect(resolveViewRole("Super Admin", "Medical Director", "Doctor")).toMatchObject({
      effective: "Medical Director",
      preview: "Medical Director",
      profession: null,
    });
  });

  it("returns cleared and plain role previews to the dashboard while preserving persona routes", () => {
    expect(previewSelectionDestination("off")).toBe("/dashboard");
    expect(previewSelectionDestination("Medical Director")).toBe("/dashboard");
    expect(previewSelectionDestination("Doctor")).toBe("/workspace?role=doctor");
    expect(previewSelectionDestination("Dietitian")).toBe("/workspace?role=diet");
  });

  it("redirects only a native Super Admin away from a clinical workspace", () => {
    expect(isNativeSuperAdmin("Super Admin", null, null)).toBe(true);
    expect(isNativeSuperAdmin("Super Admin", "Medical Director", null)).toBe(false);
    expect(isNativeSuperAdmin("Super Admin", "Doctor", "Doctor")).toBe(false);
    expect(isNativeSuperAdmin("Administrator", null, null)).toBe(false);
  });

  it("suppresses native Super Admin workspace navigation but keeps intentional previews", () => {
    expect(shouldShowWorkspaceNavigation("Super Admin", "Super Admin")).toBe(false);
    expect(shouldShowWorkspaceNavigation("Super Admin", "Medical Director")).toBe(true);
    expect(shouldShowWorkspaceNavigation("Super Admin", "Doctor")).toBe(true);
    expect(shouldShowWorkspaceNavigation("Doctor", "Doctor")).toBe(true);
  });

  it("labels the reset control with the real account role", () => {
    expect(nativeRoleOptionLabel("Super Admin", false)).toBe("View as… (Super Admin)");
    expect(nativeRoleOptionLabel("Super Admin", true)).toBe("Return to Super Admin");
    expect(nativeRoleOptionLabel("Administrator", true)).toBe("Return to Administrator");
  });
});
