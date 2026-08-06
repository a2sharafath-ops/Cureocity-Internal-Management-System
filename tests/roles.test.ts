import { describe, it, expect } from "vitest";
import {
  canSee, canBill, canManageInvoices, canEmr, canFinanceOps, canCompliance,
  canAppointments, canEditAppointments, canPos, canConsult, canReviewDietChart,
  canRecordPayment, canVoidPackage, canSetTargets, canHr, canManageBlueprint,
  canManageSessions, canMessage, hasNoReviewer, isClinician, isMedicalDirector,
  ROLE_LIST,
} from "@/lib/roles";
import { roleFromStaffRole, visibleWorkspaces, canEditWorkspace } from "@/lib/workspaces";
import { canWriteMedical, canWriteNutrition, canWriteFitness, ownsConsultKind } from "@/lib/discipline";

describe("canSee", () => {
  it("dashboard is visible to everyone", () => {
    for (const r of ["Administrator", "Manager", "Front Desk", "Doctor", "Dietitian", "Finance", "HR", "Staff"]) {
      expect(canSee(r, "/dashboard")).toBe(true);
    }
  });

  it("users nav: admins + managers (managers only to fix logins); audit admin-only", () => {
    expect(canSee("Administrator", "/users")).toBe(true);
    // Managers reach /users to fix a colleague's login; role/staff management
    // is gated separately (page canAdmin + per-action checks).
    expect(canSee("Manager", "/users")).toBe(true);
    expect(canSee("Front Desk", "/users")).toBe(false);
    expect(canSee("Administrator", "/audit")).toBe(true);
    expect(canSee("Front Desk", "/audit")).toBe(false);
  });

  it("EMR is hidden from front desk (PHI)", () => {
    expect(canSee("Doctor", "/emr")).toBe(true);
    expect(canSee("Psychologist", "/emr")).toBe(false); // EMR is Doctor-owned
    expect(canSee("Front Desk", "/emr")).toBe(false);
  });

  it("SOPs are HR-only for now, plus the owner", () => {
    expect(canSee("HR", "/kb")).toBe(true);
    expect(canSee("Super Admin", "/kb")).toBe(true);
    for (const r of ["Administrator", "Manager", "Front Desk", "Doctor", "Dietitian", "Staff"]) {
      expect(canSee(r, "/kb")).toBe(false);
    }
  });

  it("the task board is owner-only for now", () => {
    expect(canSee("Super Admin", "/tasks")).toBe(true);
    for (const r of ["Administrator", "Manager", "Front Desk", "HR", "Doctor", "Staff"]) {
      expect(canSee(r, "/tasks")).toBe(false);
    }
  });

  it("unknown routes default to visible", () => {
    expect(canSee("Staff", "/some-unmapped-route")).toBe(true);
  });
});

describe("permission helpers", () => {
  it("canBill includes Finance, excludes clinicians", () => {
    expect(canBill("Finance")).toBe(true);
    expect(canBill("Front Desk")).toBe(true);
    expect(canBill("Dietitian")).toBe(false);
  });

  it("canEmr is Doctor-owned (+admin/manager)", () => {
    expect(canEmr("Doctor")).toBe(true);
    expect(canEmr("Health Coach")).toBe(false);
    expect(canEmr("Fitness Trainer")).toBe(false);
    expect(canEmr("Manager")).toBe(true);
    expect(canEmr("Front Desk")).toBe(false);
    expect(canEmr("Finance")).toBe(false);
  });

  it("front desk can view billing but not manage invoices", () => {
    expect(canBill("Front Desk")).toBe(true);
    expect(canManageInvoices("Front Desk")).toBe(false);
    expect(canManageInvoices("Finance")).toBe(true);
    expect(canManageInvoices("Manager")).toBe(true);
  });

  it("canFinanceOps excludes front desk", () => {
    expect(canFinanceOps("Finance")).toBe(true);
    expect(canFinanceOps("Front Desk")).toBe(false);
  });

  it("canCompliance is admin/manager only", () => {
    expect(canCompliance("Administrator")).toBe(true);
    expect(canCompliance("Manager")).toBe(true);
    expect(canCompliance("Finance")).toBe(false);
  });

  it("canAppointments and canPos and canConsult sanity", () => {
    expect(canAppointments("Front Desk")).toBe(true);
    expect(canPos("Finance")).toBe(true);
    expect(canConsult("Psychologist")).toBe(true);
    expect(canConsult("Front Desk")).toBe(false);
  });

  it("appointment editing is limited; other clinicians view only", () => {
    // Can edit: SA / Admin / Manager / Front Desk / Health Coach.
    for (const r of ["Super Admin", "Administrator", "Manager", "Front Desk", "Health Coach"]) {
      expect(canEditAppointments(r)).toBe(true);
    }
    // Can view but NOT edit: the other clinicians.
    for (const r of ["Doctor", "Dietitian", "Fitness Trainer", "Psychologist"]) {
      expect(canAppointments(r)).toBe(true);
      expect(canEditAppointments(r)).toBe(false);
    }
    // No calendar access at all.
    expect(canEditAppointments("Finance")).toBe(false);
    expect(canEditAppointments("HR")).toBe(false);
  });
});

describe("workspace + whiteboard access", () => {
  it("managers use their own dashboard, not a discipline workspace", () => {
    expect(canSee("Manager", "/workspace")).toBe(false);
    expect(canSee("Manager", "/dashboard")).toBe(true);
  });
  it("clinicians keep their workspace", () => {
    for (const r of ["Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist"]) {
      expect(canSee(r, "/workspace")).toBe(true);
    }
  });
  it("every clinician joins the whiteboard; front desk and finance do not", () => {
    for (const r of ["Doctor", "Dietitian", "Fitness Trainer", "Health Coach", "Psychologist", "Manager"]) {
      expect(canSee(r, "/whiteboard")).toBe(true);
    }
    expect(canSee("Front Desk", "/whiteboard")).toBe(false);
    expect(canSee("Finance", "/whiteboard")).toBe(false);
    expect(canSee("Super Admin", "/whiteboard")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The Medical Director — clinical lead over all five disciplines.
//
// The role exists to put ONE clinical signature on the documents a client
// receives. The tests that matter most are the negative ones: this is a
// supervisor of clinicians, not a second administrator, and the moment it
// starts accruing commercial permissions "who approved this" stops meaning
// anything.
// ---------------------------------------------------------------------------
describe("Medical Director", () => {
  const MD = "Medical Director";

  it("is the only role that can approve a diet chart, plan or assessment", () => {
    expect(canReviewDietChart(MD)).toBe(true);
    for (const r of ["Super Admin", "Administrator", "Manager", "Doctor", "Dietitian", "Front Desk", "Finance", "HR", "Staff"]) {
      expect(canReviewDietChart(r)).toBe(false);
    }
  });

  it("cannot approve their own submission by wearing another hat — a dietitian is still refused", () => {
    expect(canReviewDietChart("Dietitian")).toBe(false);
  });

  it("touches no money: not billing, invoices, payments, POS or finance ops", () => {
    expect(canBill(MD)).toBe(false);
    expect(canManageInvoices(MD)).toBe(false);
    expect(canRecordPayment(MD)).toBe(false);
    expect(canPos(MD)).toBe(false);
    expect(canFinanceOps(MD)).toBe(false);
    expect(canVoidPackage(MD)).toBe(false);
    expect(canSetTargets(MD)).toBe(false);
    for (const href of ["/billing", "/expenses", "/finsheets", "/subscriptions", "/pos", "/passes", "/reports", "/packages"]) {
      expect(canSee(MD, href)).toBe(false);
    }
  });

  it("is not an HR or governance role either", () => {
    expect(canHr(MD)).toBe(false);
    expect(canCompliance(MD)).toBe(false);
    expect(canSee(MD, "/hr")).toBe(false);
    expect(canSee(MD, "/users")).toBe(false);
    expect(canSee(MD, "/audit")).toBe(false);
  });

  it("works the clinical floor: consults, records, orders, the whiteboard", () => {
    expect(canConsult(MD)).toBe(true);
    expect(canEmr(MD)).toBe(true);
    expect(canManageBlueprint(MD)).toBe(true);
    expect(canManageSessions(MD)).toBe(true);
    expect(canAppointments(MD)).toBe(true);
    expect(canMessage(MD)).toBe(true);
    for (const href of ["/clients", "/workspace", "/whiteboard", "/careteam", "/emr", "/orders", "/pro", "/meals", "/blueprint", "/telehealth", "/exlib"]) {
      expect(canSee(MD, href)).toBe(true);
    }
  });

  it("reads the calendar without owning it — scheduling stays with front desk", () => {
    expect(canEditAppointments(MD)).toBe(false);
  });

  it("is NOT a discipline: it must not resolve to one workspace", () => {
    // The whole point is reaching all five. roleFromStaffRole returning a key
    // here would pin them to that one and hide the diet queue they approve —
    // exactly the bug that hid it from the Super Admin.
    expect(roleFromStaffRole(MD)).toBeNull();
    expect(isClinician(MD)).toBe(false);
    expect(isMedicalDirector(MD)).toBe(true);
  });

  it("opens and can edit every discipline workspace", () => {
    expect(visibleWorkspaces(MD)).toEqual(["doctor", "diet", "trainer", "coach", "psych"]);
    for (const k of ["doctor", "diet", "trainer", "coach", "psych"] as const) {
      expect(canEditWorkspace(MD, k)).toBe(true);
    }
  });

  it("writes across disciplines, mirroring is_admin() in SQL", () => {
    expect(canWriteMedical(MD)).toBe(true);
    expect(canWriteNutrition(MD)).toBe(true);
    expect(canWriteFitness(MD)).toBe(true);
    for (const kind of ["Doctor", "Diet", "Trainer", "Coach", "Psychologist"]) {
      expect(ownsConsultKind(MD, kind)).toBe(true);
    }
  });

  it("hasNoReviewer warns exactly when nobody holds the role", () => {
    expect(hasNoReviewer(["Super Admin", "Administrator", "Dietitian"])).toBe(true);
    expect(hasNoReviewer([])).toBe(true);
    expect(hasNoReviewer(["Dietitian", MD])).toBe(false);
  });

  it("is offered in the assignable role list", () => {
    expect(ROLE_LIST).toContain(MD);
  });
});
