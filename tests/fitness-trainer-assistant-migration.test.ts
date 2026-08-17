import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/0188_fitness_trainer_assistant_pilot.sql"), "utf8");

describe("Fitness Trainer Assistant pilot migration", () => {
  it("is forward-only, default-off and depends explicitly on migration 0186", () => {
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(sql).toContain("Migration 0186 must be applied");
    expect(sql).toContain("STAFF_COPILOT_FITNESS_TRAINER_ENABLED=true");
    expect(sql).not.toMatch(/\b(delete from|truncate table|drop table)\b/i);
  });

  it("enforces the exact real role, task version and workflow allowlist", () => {
    expect(sql).toContain("v_role <> 'Fitness Trainer'");
    expect(sql).toContain("p_task_version is distinct from 'fitness_trainer.operational_checklist.v1'");
    expect(sql).toContain("p_policy_version is distinct from '2026-08-17.1'");
    for (const workflow of ["today_and_roster", "session_coordination", "workout_planning", "summary_and_handoff"]) {
      expect(sql).toContain(`'${workflow}'`);
    }
  });

  it("constructs all persisted text in the database and audits each review transition", () => {
    expect(sql).toContain("The database constructs every persisted field from the allowlisted key");
    expect(sql).not.toContain("p_context_snapshot jsonb");
    expect(sql).not.toContain("p_draft_text text");
    expect(sql).not.toContain("p_evidence jsonb");
    expect(sql.match(/insert into audit_log/g)).toHaveLength(3);
    expect(sql).toContain("accepted_text = draft_text");
    expect(sql).not.toContain("p_accepted_text");
    expect(sql).toContain("security definer");
  });

  it("grants only authenticated execution and stores deterministic public/operational metadata", () => {
    expect(sql).toContain("'deterministic', array['Public application metadata', 'Internal operational']");
    expect(sql).toContain("revoke all on function create_fitness_trainer_assistant_draft");
    expect(sql).toContain("grant execute on function create_fitness_trainer_assistant_draft");
    expect(sql).toContain("to authenticated");
  });
});
