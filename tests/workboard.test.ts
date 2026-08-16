import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canManageWorkboard,
  canViewWorkboard,
  missingBaselineKeys,
  validateWorkboardStatusUpdate,
  WORKBOARD_BASELINE,
  WORKBOARD_STATUSES,
} from "@/lib/workboard";

const itemId = "1ba8a8d7-7e4f-48ba-97f9-4443ea11f218";

describe("Super Admin Workboard", () => {
  it("uses only the approved three workflow states", () => {
    expect(WORKBOARD_STATUSES).toEqual(["Pending", "In progress", "Done"]);
  });

  it("keeps viewing and management owner-only", () => {
    expect(canViewWorkboard("Super Admin")).toBe(true);
    expect(canManageWorkboard("Super Admin")).toBe(true);
    for (const role of ["Administrator", "Manager", "Medical Director", "Staff", "Client"]) {
      expect(canViewWorkboard(role), role).toBe(false);
      expect(canManageWorkboard(role), role).toBe(false);
    }
  });

  it("tracks exactly the approved sprint baseline without overstating pending work", () => {
    expect(WORKBOARD_BASELINE).toEqual([
      { key: "app-feedback-navigation", title: "App Feedback navigation", status: "Done" },
      { key: "staff-copilot-framework", title: "Staff copilot framework", status: "Done" },
      { key: "super-admin-copilot", title: "Super Admin copilot", status: "In progress" },
      { key: "development-environment", title: "Development environment", status: "Done" },
      { key: "production-deployment", title: "Production deployment", status: "Done" },
      { key: "production-staff-smoke-tests", title: "Production staff-readiness smoke tests", status: "Pending" },
      { key: "development-staff-accounts", title: "Development staff test accounts", status: "Pending" },
      { key: "super-admin-preview-navigation", title: "Super Admin preview navigation clarification", status: "Pending" },
      { key: "hosted-uat-decision", title: "Hosted UAT decision", status: "Pending" },
      { key: "aws-setup-review", title: "AWS setup docs/scripts review and separate commit", status: "Pending" },
      { key: "duplicate-deploy-triggers", title: "Duplicate deployment triggers review", status: "Pending" },
      { key: "meeting-to-sprint-assistant", title: "Meeting-to-Sprint AI Assistant", status: "Pending" },
    ]);
    expect(WORKBOARD_BASELINE.filter((item) => item.status === "Done")).toHaveLength(4);
    expect(WORKBOARD_BASELINE.filter((item) => item.status === "In progress")).toHaveLength(1);
    expect(WORKBOARD_BASELINE.filter((item) => item.status === "Pending")).toHaveLength(7);
  });

  it("keeps the TypeScript baseline aligned with the forward migration", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/0184_super_admin_workboard.sql"), "utf8");
    for (const item of WORKBOARD_BASELINE) {
      expect(sql).toContain(`'${item.key}'`);
      expect(sql).toContain(`'${item.title}'`);
    }
    expect(sql).toMatch(/my_role\(\) = 'Super Admin'/);
    expect(sql).toMatch(/revoke all on table workboard_items from anon, authenticated/);
    expect(sql).toMatch(/grant update \(status\) on table workboard_items to authenticated/);
    expect(sql).toContain("insert into workboard_item_history");
    expect(sql).toContain("insert into audit_log");
  });

  it("keeps the proposed meeting assistant review-first and non-actioning", () => {
    const scope = readFileSync(resolve(process.cwd(), "docs/meeting-to-sprint-ai-assistant-scope.md"), "utf8");
    expect(scope).toContain("explicitly consented live meeting capture");
    expect(scope).toContain("authorized uploaded recording, transcript, or meeting note");
    expect(scope).toContain("Production client or staff data is not an allowed test input");
    expect(scope).toContain("Explicit Super Admin approval");
    expect(scope).toContain("approval alone still performs no external action");
    expect(scope).toContain("must not create or modify tasks");
    expect(scope).toContain("must not have unrestricted database");
  });

  it("validates status mutations and detects an incomplete baseline", () => {
    const valid = new FormData();
    valid.set("id", itemId);
    valid.set("status", "In progress");
    expect(validateWorkboardStatusUpdate(valid)).toEqual({ ok: true, id: itemId, status: "In progress" });

    valid.set("status", "Blocked");
    expect(validateWorkboardStatusUpdate(valid)).toEqual({ ok: false, error: "Choose Pending, In progress, or Done." });
    valid.set("id", "not-an-id");
    expect(validateWorkboardStatusUpdate(valid)).toEqual({ ok: false, error: "Invalid work item." });

    const present = WORKBOARD_BASELINE.slice(0, 2).map((item) => ({ item_key: item.key }));
    expect(missingBaselineKeys(present)).toEqual(WORKBOARD_BASELINE.slice(2).map((item) => item.key));
  });
});
