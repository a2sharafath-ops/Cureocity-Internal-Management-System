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
  | "Medical Director"
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

/**
 * The Medical Director — clinical lead over all five disciplines.
 *
 * Deliberately NOT a member of CLINICIAN_ROLES. That list means "a discipline
 * with its own workspace and its own caseload", and it drives
 * `roleFromStaffRole`; putting the director in it would pin them to ONE
 * discipline and lock them out of the other four — the same trap that hid the
 * diet-chart queue from the Super Admin. They reach every discipline through
 * WS_OVERSIGHT instead, landing on the doctor workspace by default because that
 * is the caseload they carry themselves.
 *
 * They are clinical oversight, not commercial: no billing, no invoices, no POS,
 * no finance sheets, no payroll. See the money helpers below — the director is
 * absent from every one.
 */
export function isMedicalDirector(role: string): boolean {
  return role === "Medical Director";
}

const CLIN = [...CLINICIAN_ROLES] as Role[];
// Clinicians plus the director — for anything on the clinical floor that the
// director supervises, which is all of it.
const CLIN_MD = [...CLIN, "Medical Director"] as Role[];

// Which nav items each role can see. "all" = every role.
export const NAV_ACCESS: Record<string, Role[] | "all"> = {
  "/dashboard": "all",
  "/clients": ["Administrator", "Manager", "Front Desk", ...CLIN_MD],
  "/onboarding": ["Administrator", "Manager", "Front Desk"],
  "/leads": ["Administrator", "Manager", "Front Desk"],
  // Communications is Super-Admin-only for now (Super Admin bypasses this map).
  "/messages": [],
  "/sessions": ["Administrator", "Manager", "Front Desk", ...CLIN_MD],
  "/classes": ["Administrator", "Manager", "Front Desk", ...CLIN_MD],
  "/appointments": ["Administrator", "Manager", "Front Desk", ...CLIN_MD],
  "/followups": ["Administrator", "Manager", "Front Desk", "Health Coach"],
  "/intake": ["Administrator", "Manager", "Front Desk"],
  "/access": ["Administrator", "Manager", "Front Desk"],
  "/trainer": ["Administrator", "Manager", ...CLIN_MD],
  // Managers have their own dashboard; the discipline workspaces are for the
  // clinicians who actually carry a caseload (Administrator keeps access for
  // previewing/supporting).
  "/workspace": ["Administrator", "Medical Director", ...CLIN],
  "/careteam": ["Administrator", "Manager", ...CLIN_MD],
  // the daily multi-disciplinary meeting — every clinician takes part
  "/whiteboard": ["Administrator", "Manager", ...CLIN_MD],
  "/telehealth": ["Administrator", "Manager", ...CLIN_MD],
  "/forms": ["Administrator", "Manager", "Front Desk", ...CLIN_MD],
  "/pro": ["Administrator", "Manager", ...CLIN_MD],
  "/meals": ["Administrator", "Manager", ...CLIN_MD],
  "/blueprint": ["Administrator", "Manager", ...CLIN_MD],
  "/packages": ["Administrator", "Manager", "Front Desk"],
  "/billing": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/expenses": ["Administrator", "Manager", "Finance"],
  "/finsheets": ["Administrator", "Manager", "Finance"],
  // SOPs are being rewritten, so the library is closed to the floor for now.
  // HR keeps it — they own the people-facing SOPs and are the ones editing.
  // (Super Admin bypasses this map.)
  "/kb": ["HR"],
  "/subscriptions": ["Administrator", "Manager", "Finance"],
  "/retention": ["Administrator", "Manager", "Front Desk"],
  "/campaigns": ["Administrator", "Manager", "Front Desk"],
  "/targets": ["Administrator", "Manager", "Front Desk"],
  "/services": ["Administrator", "Manager"],
  "/pos": ["Administrator", "Manager", "Front Desk", "Finance"],
  "/passes": ["Administrator", "Manager", "Front Desk", "Finance"],
  // Medical records & orders are Doctor-owned (enforced by RLS in 0068).
  "/emr": ["Administrator", "Manager", "Medical Director", "Doctor"],
  "/orders": ["Administrator", "Manager", "Medical Director", "Doctor"],
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
  // The task board is Super-Admin-only for now. The system still CREATES tasks
  // for everyone (booking chases, SLA breaches) and they still drive the
  // "Needs your attention" panels — this only closes the /tasks page itself.
  "/tasks": [],
  "/hr": ["Administrator", "Manager", "HR"],
  "/exlib": ["Administrator", "Manager", ...CLIN_MD],
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
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role) || isMedicalDirector(role);
}

// Who can add / edit / deactivate packages. Administrator only.
export function canManagePackages(role: string): boolean {
  return role === "Super Admin" || role === "Administrator";
}

/**
 * Who signs off a diet chart, diet plan or assessment summary before it can be
 * published: the Medical Director, and nobody else.
 *
 * This is a clinical decision, so it sits with the clinical lead rather than
 * with whoever happens to hold an admin login. Dietitians submit; they cannot
 * approve their own work.
 *
 * The cost of that clarity is a single point of failure: with no Medical
 * Director account active, every submitted chart waits. The Users & Roles page
 * warns when the clinic has none, and `hasNoReviewer` below is what it checks.
 *
 * DELIBERATE, reviewed Aug 2026: the Medical Director MAY approve a document
 * she wrote herself. She is the clinic's clinical authority and the only
 * reviewer; requiring a second signature would mean appointing a second
 * reviewer, which the clinic does not have. Self-approval is therefore allowed
 * for this role ONLY — no other role can approve anything, their own or not.
 * Please don't "fix" this into a self-approval block without asking.
 */
export function canReviewDietChart(role: string): boolean {
  return isMedicalDirector(role);
}

/** True when no active staff member can approve clinical documents. */
export function hasNoReviewer(activeRoles: string[]): boolean {
  return !activeRoles.some(canReviewDietChart);
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
  return role === "Super Admin" || ["Administrator", "Manager"].includes(role) || isClinician(role) || isMedicalDirector(role);
}

// Who owns behaviour goals, habits, adherence inputs and wearable setup. Other
// clinicians may read those records for coordination, but should not silently
// change the Health Coach's plan. Mirrors the write policies in migration 0165.
export function canManageHealthCoaching(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Medical Director", "Health Coach"].includes(role);
}

// A clinical concern can be recognised by any clinician. Commercial and
// front-desk roles deliberately stay out of this workflow.
export function canCreateClinicalReferral(role: string): boolean {
  return isClinician(role) || isMedicalDirector(role);
}

export function canOpenSafetyEvent(role: string): boolean {
  return isClinician(role) || isMedicalDirector(role);
}

// A safety event is never closed by the coach who raised it. The SOP requires
// human confirmation from the clinical escalation path.
export function canResolveSafetyEvent(role: string): boolean {
  return role === "Medical Director" || role === "Doctor";
}

// Who can drive the BluePrint flow (blood reports, generate).
export function canManageBlueprint(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role) || isMedicalDirector(role);
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
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role) || isMedicalDirector(role);
}

// Who can schedule group classes / manage bookings.
export function canClasses(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role) || isMedicalDirector(role);
}

// Who can book / manage calendar appointments.
// Who can VIEW the appointment calendar — ops roles plus every clinician (they
// need to see their own schedule).
export function canAppointments(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk"].includes(role) || isClinician(role) || isMedicalDirector(role);
}

// Who can EDIT the calendar — book, reschedule, cancel, change status. Front
// desk owns scheduling; the Health Coach coordinates the client's journey and so
// also books. The other clinicians (doctor/dietitian/trainer/psychologist) get a
// read-only calendar and conduct the consults front desk / the coach booked.
export function canEditAppointments(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Front Desk", "Health Coach"].includes(role);
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
  return role === "Super Admin" || ["Administrator", "Manager", "Medical Director", "Doctor"].includes(role);
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

/**
 * Who may DELIVER a document to a client — the PDF, the portal link, the
 * WhatsApp send.
 *
 * Delivery was gated on `canConsult`, which is far wider than authoring: a
 * Fitness Trainer or a Psychologist could generate and WhatsApp a client's
 * PRESCRIPTION or LAB REQUISITION — documents they cannot write, and cannot
 * even open in /emr. Sending a document is a clinical act; it should need at
 * least what writing it needs.
 */
export function canDeliverDoc(role: string, kind: string): boolean {
  if (kind === "rx" || kind === "lab") return canEmr(role);
  if (kind === "plan" || kind === "assess") return canReviewDietChart(role) || isAdminish(role) || role === "Dietitian";
  return canConsult(role);   // consultation summary — the clinician's own note
}

/** Anyone who works here. Mirrors is_staff() in SQL, which is `role <> 'Client'`
 *  — the client portal signs in with a real profile, so "is somebody logged in"
 *  is NOT a staff check. */
export function isStaffRole(role: string): boolean {
  return role !== "Client";
}

/** Super Admin / Administrator / Manager / Medical Director. Mirrors is_admin()
 *  in SQL, and replaces the inline copies of this list scattered through
 *  lib/actions.ts — one of which had already fallen behind. */
export function isAdminish(role: string): boolean {
  return role === "Super Admin" || ["Administrator", "Manager", "Medical Director"].includes(role);
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
  "Super Admin", "Administrator", "Manager", "Medical Director", "Front Desk",
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
  "Super Admin":         ["refund", "manageUsers", "viewAudit", "config", "finance", "hr", "phi"],
  "Administrator":       ["refund", "manageUsers", "viewAudit", "config", "finance", "hr", "phi"],
  "Manager":             ["refund", "viewAudit", "config", "finance", "hr", "phi"],
  "Medical Director":    ["phi", "viewAudit"],
  "Front Desk":          [],
  "Doctor":              ["phi"],
  "Dietitian":           ["phi"],
  "Fitness Trainer":     ["phi"],
  "Health Coach":        ["phi"],
  "Psychologist":        ["phi"],
  "Finance":             ["refund", "finance", "viewAudit"],
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
