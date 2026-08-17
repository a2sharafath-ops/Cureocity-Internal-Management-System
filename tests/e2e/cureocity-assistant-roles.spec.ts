import { expect, test } from "@playwright/test";
import {
  ASSISTANT_E2E_ACCOUNTS,
  credentialPrefix,
  expectedAssistantAvailability,
} from "../../scripts/dev-assistant-test-contract.mjs";

test.describe.configure({ mode: "serial" });

async function signIn(page: import("@playwright/test").Page, slug: string) {
  const prefix = credentialPrefix(slug);
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing local synthetic credentials for ${slug}.`);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("anonymous users cannot open the staff Assistant", async ({ page }) => {
  await page.goto("/copilot");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Cureocity Assistant", exact: true })).toHaveCount(0);
});

for (const account of ASSISTANT_E2E_ACCOUNTS) {
  test(`${account.role} sees only the governed Assistant surface`, async ({ page }) => {
    await signIn(page, account.slug);
    await page.goto("/copilot");

    await expect(page.getByRole("heading", { name: "Cureocity Assistant", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: `Cureocity Assistant for ${account.role}`, exact: true })).toBeVisible();
    await expect(page.getByText(`Role-aware, draft-only assistance for ${account.role}.`, { exact: false })).toBeVisible();
    await expect(page.getByText(/could not be loaded/i)).toHaveCount(0);

    const enabled = expectedAssistantAvailability(account, process.env);
    if (enabled) {
      await expect(page.getByText("Available", { exact: true })).toBeVisible();
      if (account.inputRole && account.inputName) {
        await expect(page.getByRole(account.inputRole, { name: account.inputName, exact: true })).toBeVisible();
      }
      if (account.submitName) {
        await expect(page.getByRole("button", { name: account.submitName, exact: true })).toBeEnabled();
      }
    } else {
      await expect(page.getByText("Configured pilot — currently off", { exact: true })).toBeVisible();
      await expect(page.getByText("The role feature flag is off.", { exact: true })).toBeVisible();
    }

    const launcher = page.getByRole("button", { name: "Cureocity Assistant", exact: true });
    await expect(launcher).toBeVisible();
    await launcher.click();

    const panel = page.getByRole("dialog", { name: "Cureocity Assistant", exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(new RegExp(`^${account.role} · review-first assistance$`))).toBeVisible();
    await expect(panel.getByRole("link", { name: "Open full workspace and history →", exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Voice input coming soon; microphone access is disabled", exact: true })).toBeDisabled();
    await expect(panel.getByText(/does not request microphone permission, record audio, or store a transcript/i)).toBeVisible();
  });
}
