import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import {
  ASSISTANT_E2E_CREDENTIAL_FILE,
  isSafeDevelopmentAppUrl,
  isSafeDevelopmentSupabaseUrl,
  parseEnvFile,
} from "./scripts/dev-assistant-test-contract.mjs";

const projectRoot = process.cwd();
const developmentEnvPath = resolve(projectRoot, ".env.development.local");
const credentialPath = resolve(projectRoot, ASSISTANT_E2E_CREDENTIAL_FILE);

if (!existsSync(developmentEnvPath)) {
  throw new Error("Missing .env.development.local. This suite runs only against AWS Development through the local tunnel.");
}
if (!existsSync(credentialPath)) {
  throw new Error(`Missing ${ASSISTANT_E2E_CREDENTIAL_FILE}. Run npm run test:assistant:e2e:provision first.`);
}

const developmentEnv = parseEnvFile(readFileSync(developmentEnvPath, "utf8")) as Record<string, string>;
const credentials = parseEnvFile(readFileSync(credentialPath, "utf8")) as Record<string, string>;
const baseURL = credentials.ASSISTANT_E2E_BASE_URL ?? "";

if (!isSafeDevelopmentSupabaseUrl(developmentEnv.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("Refusing to test: the Supabase URL is not the local AWS Development tunnel at 127.0.0.1:54321.");
}
if (!isSafeDevelopmentAppUrl(baseURL)) {
  throw new Error("Refusing to test: ASSISTANT_E2E_BASE_URL is not the local Development app at 127.0.0.1:3000.");
}

Object.assign(process.env, developmentEnv, credentials);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "cureocity-assistant-roles.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
