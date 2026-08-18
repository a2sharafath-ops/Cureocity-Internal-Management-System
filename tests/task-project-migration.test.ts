import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/0199_task_projects.sql"), "utf8");

describe("task project migration", () => {
  it("adds a project layer without changing existing tasks", () => {
    expect(sql).toContain("create table if not exists public.task_projects");
    expect(sql).toContain("add column if not exists project_id");
    expect(sql).toContain("on delete set null");
    expect(sql).toContain("Operations inbox");
    expect(sql).not.toMatch(/\b(delete from|truncate table|drop table)\b/i);
  });

  it("lets all staff read projects but limits project management to leadership", () => {
    expect(sql).toContain("create policy task_projects_read");
    expect(sql).toContain("create policy task_projects_manage");
    expect(sql).toContain("'Administrator', 'Super Admin', 'Manager'");
  });
});
