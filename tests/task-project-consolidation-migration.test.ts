import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/0201_consolidate_sprint10_projects.sql"), "utf8");

describe("Sprint 10 project consolidation migration", () => {
  it("creates outcome-level projects and remaps rather than deleting tasks", () => {
    for (const name of ["Marketing & Media", "Sales & Business Development", "ORB App Launch Event", "CREC & Clinical Partnerships", "People & HR", "App Development & IT", "Operations & Service Delivery", "Community Events & Partnerships"]) {
      expect(sql).toContain(`('${name}'`);
    }
    expect(sql).toContain("update public.tasks task");
    expect(sql).toContain("set project_id = target.id");
    expect(sql).not.toMatch(/\b(delete from|truncate table|drop table)\b/i);
  });

  it("keeps source projects as completed history after every task is remapped", () => {
    expect(sql).toContain("set status = 'completed'");
    expect(sql).toContain("Sprint 10 · Operations · ORB App launch Event");
    expect(sql).toContain("Sprint 10 · Sales & Marketing · Sales");
  });
});
