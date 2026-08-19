import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("staff WhatsApp reminder contact capture", () => {
  it("captures an international number and explicit opt-in during staff creation", () => {
    const form = read("components/AddStaffForm.tsx");
    expect(form).toContain('name="task_reminder_phone"');
    expect(form).toContain('name="task_reminder_whatsapp_opt_in"');
    expect(form).toContain('pattern="\\+[1-9][0-9]{7,14}"');
    expect(form).toContain("confirmed WhatsApp task-reminder opt-in");
  });

  it("validates country-code format and persists consent with the staff row", () => {
    const actions = read("lib/actions.ts");
    expect(actions).toContain("const INTERNATIONAL_PHONE = /^\\+[1-9]\\d{7,14}$/");
    expect(actions).toContain("WhatsApp number must include the country code");
    expect(actions).toContain("task_reminder_phone: reminderPhone || null");
    expect(actions).toContain("task_reminder_whatsapp_opt_in: Boolean(reminderPhone) && reminderOptIn");
  });

  it("uses the same international format in Reminder contacts", () => {
    const contacts = read("components/TaskReminderContacts.tsx");
    expect(contacts).toContain('placeholder="e.g. +919876543210"');
    expect(contacts).toContain('pattern="\\+[1-9][0-9]{7,14}"');
  });
});
