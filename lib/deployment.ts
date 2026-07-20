// Deployment scoping — run the same codebase as a single-module app.
//
// Set NEXT_PUBLIC_MODULE_SCOPE on a Vercel project and that deployment only
// exposes that module: the nav shows one section, every other route redirects
// home, and sign-in lands on the module instead of the dashboard. Roles and
// permissions are untouched — a Front Desk user is still Front Desk, they just
// can't wander while they're on this URL.
//
// IMPORTANT: this is UI scoping, not access control. Both deployments talk to
// the same Supabase with the same logins, so anyone with an account can still
// open the main URL and see everything their role allows. Use it to focus a
// pilot, not to restrict a person — for that, restrict the role and the RLS.

export type ModuleScope = {
  label: string;
  home: string;
  /** route prefixes this deployment exposes */
  routes: string[];
};

export const MODULE_SCOPES: Record<string, ModuleScope> = {
  crm: {
    label: "CRM & Leads",
    home: "/leads",
    routes: ["/leads"],
  },
};

/** The active scope for this deployment, or null for the full app. */
export function moduleScope(): ModuleScope | null {
  const key = (process.env.NEXT_PUBLIC_MODULE_SCOPE ?? "").trim().toLowerCase();
  return key ? MODULE_SCOPES[key] ?? null : null;
}

/** Does this deployment expose the given route at all? */
export function scopeAllows(href: string): boolean {
  const scope = moduleScope();
  if (!scope) return true;
  return scope.routes.some((r) => href === r || href.startsWith(r + "/"));
}
