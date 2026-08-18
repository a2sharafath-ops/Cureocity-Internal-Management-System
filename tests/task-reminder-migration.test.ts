import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/0198_task_reminder_automation.sql"), "utf8");

describe("task reminder contact migration", () => {
  it("is additive, transactionally scoped and opt-in by default", () => {
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(sql).toContain("task_reminder_phone");
    expect(sql).toContain("task_reminder_whatsapp_opt_in boolean not null default false");
    expect(sql).not.toMatch(/\b(delete from|truncate table|drop table)\b/i);
  });

  it("does not conflate staff operational contact with client consent", () => {
    expect(sql).toContain("Never reuse client phone/consent fields");
    expect(sql).toContain("Explicit staff opt-in");
  });
});
