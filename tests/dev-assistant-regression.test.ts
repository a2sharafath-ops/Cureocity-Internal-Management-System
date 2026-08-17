import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ASSISTANT_E2E_ACCOUNTS,
  ASSISTANT_E2E_CREDENTIAL_FILE,
  credentialPrefix,
  expectedAssistantAvailability,
  isSafeDevelopmentAppUrl,
  isSafeDevelopmentSupabaseUrl,
  parseEnvFile,
  syntheticEmail,
} from "../scripts/dev-assistant-test-contract.mjs";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Development Assistant role regression contract", () => {
  it("covers all thirteen staff roles with unique synthetic identities", () => {
    expect(ASSISTANT_E2E_ACCOUNTS).toHaveLength(13);
    expect(new Set(ASSISTANT_E2E_ACCOUNTS.map((account) => account.role)).size).toBe(13);
    expect(new Set(ASSISTANT_E2E_ACCOUNTS.map((account) => syntheticEmail(account.slug))).size).toBe(13);
    expect(ASSISTANT_E2E_ACCOUNTS.every((account) => syntheticEmail(account.slug).endsWith("@cureocity.test"))).toBe(true);
    expect(credentialPrefix("medical_director")).toBe("ASSISTANT_E2E_MEDICAL_DIRECTOR");
  });

  it("fails closed for hosted or production-like targets", () => {
    expect(isSafeDevelopmentSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isSafeDevelopmentSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isSafeDevelopmentSupabaseUrl("https://project.supabase.co")).toBe(false);
    expect(isSafeDevelopmentSupabaseUrl("http://127.0.0.1:54322")).toBe(false);
    expect(isSafeDevelopmentAppUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isSafeDevelopmentAppUrl("https://app.cureocity.in")).toBe(false);
  });

  it("derives enabled state from the global guard, exact role flag and AI requirement", () => {
    const staff = ASSISTANT_E2E_ACCOUNTS.find((account) => account.role === "Staff")!;
    const superAdmin = ASSISTANT_E2E_ACCOUNTS.find((account) => account.role === "Super Admin")!;
    expect(expectedAssistantAvailability(staff, { STAFF_COPILOT_STAFF_ENABLED: "true" })).toBe(true);
    expect(expectedAssistantAvailability(staff, { CUREOCITY_ASSISTANT_DISABLED: "true", STAFF_COPILOT_STAFF_ENABLED: "true" })).toBe(false);
    expect(expectedAssistantAvailability(superAdmin, { STAFF_COPILOT_SUPER_ADMIN_ENABLED: "true" })).toBe(false);
    expect(expectedAssistantAvailability(superAdmin, { STAFF_COPILOT_SUPER_ADMIN_ENABLED: "true", OPENAI_API_KEY: "configured" })).toBe(true);
  });

  it("keeps credentials ignored and prevents the browser suite from submitting drafts", () => {
    expect(ASSISTANT_E2E_CREDENTIAL_FILE).toMatch(/^\.env.*\.local$/);
    expect(source(".gitignore")).toContain(".env*.local");
    const provisioner = source("scripts/provision-dev-assistant-test-accounts.mjs");
    const browserSuite = source("tests/e2e/cureocity-assistant-roles.spec.ts");
    expect(provisioner).toContain("mode: 0o600");
    expect(provisioner).toContain("synthetic_scope");
    expect(provisioner).toContain("isSafeDevelopmentSupabaseUrl");
    expect(provisioner).not.toMatch(/console\.log\([^\n]*(password|email)/i);
    expect(browserSuite).not.toMatch(/submitName[^\n]*\.click\(/);
    expect(browserSuite).toContain("anonymous users cannot open the staff Assistant");
  });

  it("uses programmatically associated login labels for browser and assistive-technology access", () => {
    const login = source("app/login/page.tsx");
    expect(login).toContain('htmlFor="login-email"');
    expect(login).toContain('id="login-email"');
    expect(login).toContain('htmlFor="login-password"');
    expect(login).toContain('id="login-password"');
  });

  it("parses values without treating comments as configuration", () => {
    expect(parseEnvFile("# comment\nA=1\nB='two'\nC=\"three\"\n")).toEqual({ A: "1", B: "two", C: "three" });
  });
});
