import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canManageWorkboard,
  canViewWorkboard,
  missingBaselineKeys,
  orderedWorkboardWorkstreams,
  validateWorkboardStatusUpdate,
  WORKBOARD_BASELINE,
  WORKBOARD_STATUSES,
  WORKBOARD_WORKSTREAMS,
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

  it("groups the complete evidence-backed backlog without overstating completion", () => {
    expect(WORKBOARD_WORKSTREAMS).toEqual([
      "Product roadmap",
      "Development configuration",
      "Production readiness",
      "AWS Production migration",
      "Security & operations",
    ]);
    expect(WORKBOARD_BASELINE).toHaveLength(23);
    expect(new Set(WORKBOARD_BASELINE.map((item) => item.key)).size).toBe(WORKBOARD_BASELINE.length);
    expect(WORKBOARD_BASELINE.filter((item) => item.status === "Done")).toHaveLength(5);
    expect(WORKBOARD_BASELINE.filter((item) => item.status === "In progress")).toHaveLength(1);
    expect(WORKBOARD_BASELINE.filter((item) => item.status === "Pending")).toHaveLength(17);
    expect(Object.fromEntries(WORKBOARD_WORKSTREAMS.map((workstream) => [
      workstream,
      WORKBOARD_BASELINE.filter((item) => item.workstream === workstream).length,
    ]))).toEqual({
      "Product roadmap": 4,
      "Development configuration": 4,
      "Production readiness": 2,
      "AWS Production migration": 9,
      "Security & operations": 4,
    });
  });

  it("makes the no-UAT AWS cutover and configuration gates explicit", () => {
    const byKey = new Map(WORKBOARD_BASELINE.map((item) => [item.key, item]));
    expect(byKey.get("production-deployment")).toMatchObject({
      title: "Current Vercel Production deployment",
      status: "Done",
    });
    expect(byKey.get("hosted-uat-decision")).toMatchObject({
      title: "No-UAT Production release path decision",
      status: "Done",
    });
    for (const key of [
      "aws-production-target",
      "production-backup-restore-rollback",
      "production-data-storage-migration",
      "production-auth-staff-migration",
      "aws-production-app-runtime",
      "aws-production-cutover",
      "production-dns-cutover-verification",
      "hosted-production-retirement",
      "production-secrets-inventory",
      "production-monitoring-alerts",
      "development-ebs-encryption",
    ]) {
      expect(byKey.get(key), key).toMatchObject({ status: "Pending" });
    }
    expect(byKey.get("super-admin-copilot")).toMatchObject({
      workstream: "Development configuration",
      status: "In progress",
    });
  });

  it("orders upgraded categories and remains readable before migration 0185", () => {
    expect(orderedWorkboardWorkstreams(WORKBOARD_BASELINE)).toEqual(WORKBOARD_WORKSTREAMS);
    expect(orderedWorkboardWorkstreams([
      { workstream: "Release" },
      { workstream: "Product roadmap" },
      { workstream: "Environments" },
    ])).toEqual(["Product roadmap", "Environments", "Release"]);
  });

  it("keeps the TypeScript baseline aligned with the idempotent forward upgrade", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/0185_expand_super_admin_workboard.sql"), "utf8");
    for (const item of WORKBOARD_BASELINE) {
      expect(sql).toContain(`'${item.key}'`);
      expect(sql).toContain(`'${item.title}'`);
    }
    expect(sql).toContain("on conflict (item_key) do nothing");
    expect(sql).toContain("previous_status is distinct from 'Done'");
    expect(sql).toContain("previous_status || ' -> Done; no hosted UAT path confirmed'");
    expect(sql).toContain("alter table workboard_items disable trigger workboard_status_guard");
    expect(sql).toContain("alter table workboard_items enable trigger workboard_status_guard");
    expect(sql.match(/\bset status\s*=/gi)).toHaveLength(1);
    expect(sql).toContain("insert into workboard_item_history");
    expect(sql).toContain("insert into audit_log");
    expect(sql).toContain("where not exists (\n  select 1 from audit_log");
    expect(sql).not.toMatch(/\b(delete from|truncate table|drop table)\b/i);
    expect(sql).toContain("Development-only OPENAI_API_KEY");
    expect(sql).toContain("STAFF_COPILOT_SUPER_ADMIN_ENABLED only in Development");
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
