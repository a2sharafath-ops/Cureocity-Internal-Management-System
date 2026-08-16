import { getPersona } from "@/lib/personas";

export type ViewRole = {
  real: string;
  effective: string;
  preview: string | null;
  profession: string | null;
};

export function resolveViewRole(
  real: string,
  previewCookie?: string | null,
  professionCookie?: string | null,
): ViewRole {
  if (real !== "Administrator" && real !== "Super Admin") {
    return { real, effective: real, preview: null, profession: null };
  }

  const preview = previewCookie || null;
  // A profession preview is valid only when both cookies describe the same
  // persona. This prevents a stale profession cookie from overriding a newer
  // role selection in the header.
  const profession = preview === professionCookie && getPersona(professionCookie)
    ? professionCookie
    : null;

  return { real, effective: preview ?? real, preview, profession };
}

export function previewSelectionDestination(role: string): string {
  return getPersona(role)?.route ?? "/dashboard";
}

export function nativeRoleOptionLabel(realRole: string, previewActive: boolean): string {
  return previewActive ? `Return to ${realRole}` : `View as… (${realRole})`;
}

export function isNativeSuperAdmin(
  realRole: string,
  preview: string | null,
  profession: string | null,
): boolean {
  return realRole === "Super Admin" && !preview && !profession;
}

export function shouldShowWorkspaceNavigation(realRole: string, displayRole: string): boolean {
  return !(realRole === "Super Admin" && displayRole === "Super Admin");
}
