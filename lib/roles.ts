// Role → permissions map (mirrors the prototype's RBAC, simplified).

// The five clinical discipline roles. Each has its own login and its own
// discipline workspace, but they share the same clinician permission set
// (what used to be the single "Health Professional" role).
export const CLINICIAN_ROLES = ["Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist"] as const;

export type Role =
  | "Super Admin"
  | "Administrator"
  | "Manager"
  | "Front Desk"
  | "Doctor"
  | "Dietitian"
  | "Fitness Trainer"
  | "Health Coach"
  | "Psychologist"
  | "Finance"
  | "HR"
  | "Staff";

export function isClinician(role: string): boolean {
  return (CLINICIAN_ROLES as readonly string[]).includes(role);
}

const CLIN = [...CLINICIAN_ROLES] as Role[];

// Which nav items each role can see. "all" = every role.
export const NAV_ACCESS: Record<string, Role[] | "all"> = {
  "/dashboard": "all",
  "/clients": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/leads": ["Administrator", "Manager", "Front Desk"],
  "/messages": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/sessions": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/classes": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/appointments": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/followups": ["Administrator", "Manager", "Front Desk"],
  "/intake": ["Administrator", "Manager", "Front Desk"],
  "/access": ["Administrator", "Manager", "Front Desk"],
  "/trainer": ["Administrator", "Manager", ...CLIN],
  "/workspace": ["Administrator", "Manager", ...CLIN],
  "/careteam": ["Administrator", "Manager", ...CLIN],
  "/telehealth": ["Administrator", "Manager", ...CLIN],
  "/forms": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/pro": ["Administrator", "Manager", ...CLIN],
  "/meals": ["Administrator", "Manager", ...CLIN],
  "/blueprint": ["Administrator", "Manager", ...CLIN],
  "/packages": ["Administrator", "Manager", "Front Desk"],
  "/billing": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/expenses": ["Administrator", "Manager", "Finance"],
  "/finsheets": ["Administrator", "Manager", "Finance"],
  "/kb": "all",
  "/subscriptions": ["Administrator", "Manager", "Finance"],
  "/retention": ["Administrator", "Manager", "Front Desk"],
  "/campaigns": ["Administrator", "Manager", "Front Desk"],
  "/targets": ["Administrator", "Manager", "Front Desk"],
  "/services": ["Administrator", "Manager"],
  "/pos": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/passes": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/emr": ["Administrator", "Manager", ...CLIN],
  "/orders": ["Administrator", "Manager", ...CLIN],
  "/claims": ["Administrator", "Manager", "Finance"],
  "/reports": ["Administrator", "Manager", "Finance"],
  "/users": ["Administrator"],
  "/compliance": ["Administrator", "Manager"],
  "/tasks": "all",
  "/hr": ["Administrator", "Manager", "HR"],
  "/exlib": ["Administrator", "Manager", ...CLIN],
  "/notifications": ["Administrator", "Manager"],
  "/audit": ["Administrator"],
};

export function canSee(role: string, href: string): boolean {
  if (role === "Super Admin") return true;
  const rule = NAV_ACCESS[href];
  if (!rule) return true;
  if (rule === "all") return true;
  return (rule as string[]).includes(role);
}

// Who can create/edit clients and move leads.
export function canWrite(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role);
}

// Who can reschedule / complete strength sessions (front desk + clinicians).
export function canManageSessions(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role);
}

// Who can activate/deactivate packages.
export function canManagePackages(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role);
}

// Who can run consultations / write summaries.
export function canConsult(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role) || isClinician(role);
}

// Who can drive the BluePrint flow (blood reports, generate).
export function canManageBlueprint(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role);
}

// Who can VIEW billing (page + client-card billing section). Front Desk included.
export function canBill(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk", "Finance"].includes(role);
}

// Who can CREATE / EDIT invoices (mark paid, refund). Front Desk is view-only.
export function canManageInvoices(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Finance"].includes(role);
}

// Who can message clients.
export function canMessage(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role);
}

// Who can schedule group classes / manage bookings.
export function canClasses(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role);
}

// Who can book / manage calendar appointments.
export function canAppointments(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role);
}

// Who can manage retention (at-risk, NPS, referrals).
export function canRetention(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role);
}

// Who can sell passes / run the retail POS.
export function canPos(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk", "Finance"].includes(role);
}

// Who can view/edit the clinical EMR (PHI — clinicians only).
export function canEmr(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role) || isClinician(role);
}

// Who can manage insurance & claims.
export function canClaims(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Finance"].includes(role);
}

// Who can access compliance & governance (consent, breach, retention).
export function canCompliance(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role);
}

// Who can manage message templates & campaigns.
export function canCampaigns(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role);
}

// Who can manage HR (attendance, leave, payroll).
export function canHr(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "HR"].includes(role);
}

// The assignable roles, in seniority order (for the Users & Roles cards).
export const ROLE_LIST: Role[] = [
  "Super Admin", "Administrator", "Manager", "Front Desk",
  "Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist",
  "Finance", "HR", "Staff",
];

// Short area labels for each nav route (mirrors the prototype's area codes).
const AREA_LABEL: Record<string, string> = {
  "/dashboard": "dash", "/leads": "crm", "/clients": "clients", "/appointments": "booking",
  "/sessions": "training", "/followups": "followups", "/messages": "comms", "/retention": "retention",
  "/targets": "targets", "/intake": "intake", "/access": "access", "/workspace": "workspace",
  "/careteam": "careteam", "/telehealth": "telehealth", "/pro": "consults", "/meals": "meals",
  "/blueprint": "blueprint", "/trainer": "trainer", "/emr": "emr", "/orders": "orders",
  "/packages": "packages", "/services": "services", "/billing": "invoices", "/expenses": "expenses",
  "/finsheets": "finsheets", "/subscriptions": "subscriptions", "/pos": "pos", "/passes": "passes",
  "/claims": "insurance", "/reports": "reports", "/compliance": "governance", "/users": "users",
  "/hr": "hr", "/exlib": "exlib", "/notifications": "notifications", "/audit": "audit",
  "/kb": "kb", "/tasks": "tasks", "/classes": "classes", "/campaigns": "campaigns",
};

// The nav areas a role can see, as a label list — or "all".
export function accessAreaList(role: string): string[] | "all" {
  const routes = Object.keys(NAV_ACCESS);
  const seen = routes.filter((h) => canSee(role, h));
  if (seen.length === routes.length) return "all";
  return Array.from(new Set(seen.map((h) => AREA_LABEL[h] ?? h.slice(1))));
}

// How many nav areas a role can see — "all" if it sees everything.
export function accessAreas(role: string): number | "all" {
  const list = accessAreaList(role);
  return list === "all" ? "all" : list.length;
}

// Capability flags per role (mirrors the prototype's RBAC capability set).
export const ROLE_CAPS: Record<string, string[]> = {
  "Super Admin":         ["refund", "manageUsers", "viewAudit", "config", "finance", "hr", "phi", "insurance"],
  "Administrator":       ["refund", "manageUsers", "viewAudit", "config", "finance", "hr", "phi", "insurance"],
  "Manager":             ["refund", "viewAudit", "config", "finance", "hr", "phi", "insurance"],
  "Front Desk":          [],
  "Doctor":              ["phi"],
  "Dietitian":           ["phi"],
  "Fitness Trainer":     ["phi"],
  "Health Coach":        ["phi"],
  "Psychologist":        ["phi"],
  "Finance":             ["refund", "finance", "viewAudit", "insurance"],
  "HR":                  ["hr"],
  "Staff":               [],
};
export function roleCapabilities(role: string): string[] { return ROLE_CAPS[role] ?? []; }
