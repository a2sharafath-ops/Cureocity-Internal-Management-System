import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/0186_staff_assistant_policy_foundation.sql"), "utf8");

describe("Staff Assistant draft foundation migration", () => {
  it("is forward-only, default-off and scoped to the exact Staff task contract", () => {
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(sql).toContain("STAFF_COPILOT_STAFF_ENABLED=true");
    expect(sql).toContain("p_task_key <> 'navigation_checklist'");
    expect(sql).toContain("p_policy_version <> '2026-08-17.1'");
    expect(sql).toContain("p_task_version <> 'staff.navigation_checklist.v1'");
    expect(sql).not.toMatch(/\b(delete from|truncate table)\b/i);
  });

  it("keeps generated evidence immutable and direct writes unavailable", () => {
    expect(sql).toContain("Generated Cureocity Assistant evidence is immutable");
    expect(sql).toContain("revoke all on table staff_assistant_drafts from anon, authenticated");
    expect(sql).toContain("grant select on table staff_assistant_drafts to authenticated");
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all).*staff_assistant_drafts\s+to authenticated/i);
    expect(sql).not.toContain("for delete");
  });

  it("uses self-only real-role RLS and atomic draft plus audit RPCs", () => {
    expect(sql).toContain("created_by = auth.uid()");
    expect(sql).toContain("role_name = my_role()");
    expect(sql).toContain("my_role() <> 'Client'");
    expect(sql).toContain("v_role <> 'Staff'");
    expect(sql).toContain("create_staff_assistant_draft");
    expect(sql).toContain("accept_staff_assistant_draft");
    expect(sql).toContain("discard_staff_assistant_draft");
    expect(sql.match(/insert into audit_log/g)).toHaveLength(3);
    expect(sql).toContain("security definer");
  });

  it("grants only authenticated execution and stores no model for the deterministic pilot", () => {
    expect(sql).toContain("'deterministic', array['Public application metadata']");
    expect(sql).toContain("p_context_snapshot->>'role' <> 'Staff'");
    expect(sql).toContain("revoke all on function create_staff_assistant_draft");
    expect(sql).toContain("grant execute on function create_staff_assistant_draft");
    expect(sql).toContain("to authenticated");
  });
});
