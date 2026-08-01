// Role → permissions map (mirrors the prototype's RBAC, simplified).


import { moduleScope, scopeAllows } from "@/lib/deployment";

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
  "/onboarding": ["Administrator", "Manager", "Front Desk"],
  "/leads": ["Administrator", "Manager", "Front Desk"],
  // Communications is Super-Admin-only for now (Super Admin bypasses this map).
  "/messages": [],
  "/sessions": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/classes": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/appointments": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/followups": ["Administrator", "Manager", "Front Desk", "Health Coach"],
  "/intake": ["Administrator", "Manager", "Front Desk"],
  "/access": ["Administrator", "Manager", "Front Desk"],
  "/trainer": ["Administrator", "Manager", ...CLIN],
  // Managers have their own dashboard; the discipline workspaces are for the
  // clinicians who actually carry a caseload (Administrator keeps access for
  // previewing/supporting).
  "/workspace": ["Administrator", ...CLIN],
  "/careteam": ["Administrator", "Manager", ...CLIN],
  // the daily multi-disciplinary meeting — every clinician takes part
  "/whiteboard": ["Administrator", "Manager", ...CLIN],
  "/telehealth": ["Administrator", "Manager", ...CLIN],
  "/forms": ["Administrator", "Manager", "Front Desk", ...CLIN],
  "/pro": ["Administrator", "Manager", ...CLIN],
  "/meals": ["Administrator", "Manager", ...CLIN],
  "/blueprint": ["Administrator", "Manager", ...CLIN],
  "/packages": ["Administrator", "Manager", "Front Desk"],
  "/billing": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/expenses": ["Administrator", "Manager", "Finance"],
  "/finsheets": ["Administrator", "Manager", "Finance"],
  "/kb": ["Administrator", "Manager", "Front Desk", ...CLIN, "HR", "Staff"],
  "/subscriptions": ["Administrator", "Manager", "Finance"],
  "/retention": ["Administrator", "Manager", "Front Desk"],
  "/campaigns": ["Administrator", "Manager", "Front Desk"],
  "/targets": ["Administrator", "Manager", "Front Desk"],
  "/services": ["Administrator", "Manager"],
  "/pos": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/passes": ["Administrator", "Manager", "Front Desk", "Finance"],
  // Medical records & orders are Doctor-owned (enforced by RLS in 0068).
  "/emr": ["Administrator", "Manager", "Doctor"],
  "/orders": ["Administrator", "Manager", "Doctor"],
  "/reports": ["Administrator", "Manager", "Finance"],
  // Managers see a read-only roster with the sign-in controls only; role,
  // branch, rename, delete and add-staff remain Administrator / Super Admin
  // and are enforced in the server actions, not just hidden in the page.
  // Managers get the /users nav for one reason — fixing a colleague's login
  // (email / password reset). Roles, add-staff, branches, renames and deletes
  // stay with Administrator + Super Admin, enforced independently in the page
  // (canAdmin) and in each server action.
  "/users": ["Administrator", "Manager"],
  "/compliance": ["Administrator", "Manager"],
  "/tasks": "all",
  "/hr": ["Administrator", "Manager", "HR"],
  "/exlib": ["Administrator", "Manager", ...CLIN],
  "/notifications": ["Administrator", "Manager"],
  "/audit": ["Administrator"],
  "/templates": ["Administrator", "Manager"],
};

/**
 * Where a role should land on sign-in. On a module-scoped deployment everyone
 * lands on that module instead of the dashboard.
 */
export function homeFor(role: string): string {
  return moduleScope()?.home ?? "/dashboard";
}

export function canSee(role: string, href: string): boolean {
  // A module-scoped deployment (the CRM pilot, say) exposes only its own
  // routes — to every role, Super Admin included. This is UI scoping for a
  // focused rollout, not a security boundary; see lib/deployment.ts.
  if (!scopeAllows(href)) return false;

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

// Who can work the follow-up queue (call → link → review → book/close). The
// front-desk writers plus the Health Coach, who owns the Day-2 diet chart
// explanation and other coaching touchpoints.
export function canWorkFollowups(role: string): boolean {
  return canWrite(role) || role === "Health Coach";
}

// Who can reschedule / complete strength sessions (front desk + clinicians).
export function canManageSessions(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role);
}

// Who can add / edit / deactivate packages. Administrator only.
export function canManagePackages(role: string): boolean {
  return role === "Super Admin" || role === "Administrator";
}

// Who reviews / approves a diet chart before it can be published — the Medical
// Director (Doctor), plus Admin / Super Admin oversight. Dietitians submit but
// cannot approve their own charts.
export function canReviewDietChart(role: string): boolean {
  // Diet-chart sign-off sits with the Super Admin (with Administrator as backup).
  return role === "Super Admin" || role === "Administrator";
}

// Who can approve a leave-type entitlement change (Manager / Admin only). HR can
// propose changes but not apply them.
export function canApproveLeaveType(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role);
}

// Who can void a package added to a client (soft-cancel, keeps the audit row).
// Admin + Manager only — front desk sells but doesn't reverse a sale.
export function canVoidPackage(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role);
}

// Who can manage the services catalog. Admin + Manager.
export function canManageServices(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role);
}

// Who can set monthly sales targets. Administrator only.
export function canSetTargets(role: string): boolean {
  return role === "Super Admin" || role === "Administrator";
}

// Who can add / delete SOPs (knowledge base). Admin + HR.
export function canManageSops(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "HR"].includes(role);
}

// Who can create tasks. Admin + Manager + HR.
export function canManageTasks(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "HR"].includes(role);
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

// Who can CREATE / EDIT invoices (raise, void, refund). Front Desk is view-only
// for these — they don't originate or reverse invoices.
export function canManageInvoices(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Finance"].includes(role);
}

// Who actually COLLECTS the money and marks an invoice paid. Front Desk is the
// front-line collector (they're the ones chased to collect), Finance is the
// hands-on collector, and overseers can settle directly if needed.
export function canRecordPayment(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk", "Finance"].includes(role);
}

// Super Admin / Admin / Manager oversee collections — they don't collect the
// cash themselves, so on invoices they chase the assignee (Front Desk / Finance)
// instead of marking an invoice paid. Finance stays the hands-on collector.
export function isBillingOverseer(role: string): boolean {
  return ["Super Admin", "Administrator", "Manager"].includes(role);
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

// Who can view/edit the clinical EMR + orders. Doctor-owned (RLS 0067/0068).
export function canEmr(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Doctor"].includes(role);
}

// Finance-ops gate: manage the petty-cash float, top-ups and reimbursement
// review in Finance Sheets. Admin / Manager / Finance (Super Admin implied).
export function canFinanceOps(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Finance"].includes(role);
}

// Reimbursements: the accountant (Finance) and admins raise a claim; only
// Super Admin approves and pays it (keeps the money-out decision with one role).
export function canReimburseSubmit(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Finance"].includes(role);
}
export function canReimburseApprove(role: string): boolean {
  return role === "Super Admin";
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
  "/dashboard": "dash", "/leads": "crm", "/clients": "clients", "/onboarding": "clients", "/appointments": "booking",
  "/sessions": "training", "/followups": "followups", "/messages": "comms", "/retention": "retention",
  "/targets": "targets", "/intake": "intake", "/access": "access", "/workspace": "workspace",
  "/careteam": "careteam", "/whiteboard": "whiteboard", "/telehealth": "telehealth", "/pro": "consults", "/meals": "meals",
  "/blueprint": "blueprint", "/trainer": "trainer", "/emr": "emr", "/orders": "orders",
  "/packages": "packages", "/services": "services", "/billing": "invoices", "/expenses": "expenses",
  "/finsheets": "finsheets", "/subscriptions": "subscriptions", "/pos": "pos", "/passes": "passes",
  "/reports": "reports", "/compliance": "governance", "/users": "users",
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

/**
 * Roles that can own a lead. Deliberately narrow: leads are a front-desk and
 * management concern, so clinicians and trainers are not offered as owners
 * even though they are staff.
 */
export const LEAD_OWNER_ROLES = ["Front Desk", "Manager", "Administrator", "Super Admin"];
