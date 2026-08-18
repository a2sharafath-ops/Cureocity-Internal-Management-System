import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/0200_shared_task_assignments.sql"), "utf8");

describe("shared task assignments migration", () => {
  it("adds an additive, staff-scoped join table and backfills existing owners", () => {
    expect(sql).toContain("create table if not exists public.task_assignees");
    expect(sql).toContain("primary key (task_id, staff_id)");
    expect(sql).toContain("on delete cascade");
    expect(sql).toContain("select id, assignee_id, created_by");
    expect(sql).toContain("on conflict (task_id, staff_id) do nothing");
    expect(sql).toContain("set_shared_task_assignees");
    expect(sql).toContain("update tasks set assignee_id = ids[1]");
    expect(sql).not.toMatch(/\b(truncate table|drop table|delete from\s+public\.tasks)\b/i);
  });

  it("keeps shared assignments available to staff and realtime clients", () => {
    expect(sql).toContain("create policy task_assignees_staff");
    expect(sql).toContain("is_staff()");
    expect(sql).toContain("add table public.task_assignees");
  });
});
