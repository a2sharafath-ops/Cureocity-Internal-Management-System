import { describe, it, expect } from "vitest";
import { canSee, canBill, canManageInvoices, canEmr, canClaims, canCompliance, canAppointments, canPos, canConsult } from "@/lib/roles";

describe("canSee", () => {
  it("dashboard is visible to everyone", () => {
    for (const r of ["Administrator", "Manager", "Front Desk", "Doctor", "Dietitian", "Finance", "HR", "Staff"]) {
      expect(canSee(r, "/dashboard")).toBe(true);
    }
  });

  it("users & audit are admin-only", () => {
    expect(canSee("Administrator", "/users")).toBe(true);
    expect(canSee("Manager", "/users")).toBe(false);
    expect(canSee("Administrator", "/audit")).toBe(true);
    expect(canSee("Front Desk", "/audit")).toBe(false);
  });

  it("EMR is hidden from front desk (PHI)", () => {
    expect(canSee("Doctor", "/emr")).toBe(true);
    expect(canSee("Psychologist", "/emr")).toBe(false); // EMR is Doctor-owned
    expect(canSee("Front Desk", "/emr")).toBe(false);
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

  it("canClaims excludes front desk", () => {
    expect(canClaims("Finance")).toBe(true);
    expect(canClaims("Front Desk")).toBe(false);
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
});
