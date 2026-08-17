import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/0196_hr_assistant_pilot.sql"), "utf8");

describe("HR Assistant pilot migration", () => {
  it("is forward-only, default-off and depends on 0186", () => {
    expect(sql).toContain("begin;"); expect(sql).toContain("commit;");
    expect(sql).toContain("Migration 0186 must be applied");
    expect(sql).toContain("STAFF_COPILOT_HR_ENABLED=true");
    expect(sql).not.toMatch(/\b(delete from|truncate table|drop table)\b/i);
  });
  it("enforces exact role, versions and workflow allowlist", () => {
    expect(sql).toContain("v_role <> 'HR'");
    expect(sql).toContain("p_task_version is distinct from 'hr.process_checklist.v1'");
    expect(sql).toContain("p_policy_version is distinct from '2026-08-17.1'");
    for (const key of ["onboarding_offboarding_process", "attendance_leave_process", "training_policy_guidance", "capacity_privacy_review"]) expect(sql).toContain(`'${key}'`);
  });
  it("constructs immutable text and audits all transitions", () => {
    expect(sql).toContain("constructs all persisted text from the allowlisted key");
    expect(sql).not.toContain("p_draft_text text"); expect(sql).not.toContain("p_evidence jsonb");
    expect(sql.match(/insert into audit_log/g)).toHaveLength(3);
    expect(sql).toContain("accepted_text=draft_text"); expect(sql).toContain("security definer");
  });
  it("grants only authenticated execution", () => {
    expect(sql).toContain("'deterministic',array['Public application metadata','Internal operational']");
    expect(sql).toContain("revoke all on function create_hr_assistant_draft");
    expect(sql).toContain("grant execute on function create_hr_assistant_draft");
    expect(sql).toContain("to authenticated");
  });
});
