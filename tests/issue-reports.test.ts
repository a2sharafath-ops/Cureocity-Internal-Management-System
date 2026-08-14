import { describe, expect, it } from "vitest";
import {
  canReportIssue,
  canTriageIssues,
  clientRefFromRoute,
  normaliseIssueRoute,
  validateIssueSubmission,
  validateIssueTriage,
} from "@/lib/issue-reports";

const id = "9b4232a4-1bdd-4c32-a397-0c26f64eb3bc";

function reportData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    type: "Bug",
    severity: "High",
    description: "The save button stopped after I clicked it.",
    route: `/clients/${id}?tab=medical#notes`,
    browser_context: JSON.stringify({ browser: "TestBrowser/1", platform: "Mac", viewport: "1440x900", token: "secret" }),
    submission_key: "stable-form-key",
    ...overrides,
  })) data.set(key, value);
  return data;
}

describe("issue report privacy and validation", () => {
  it("captures a clean pathname, pseudonymous client reference and allowlisted device context", () => {
    const result = validateIssueSubmission(reportData());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.route).toBe(`/clients/${id}`);
    expect(result.value.clientRef).toBe(id);
    expect(result.value.browserContext).toEqual({ browser: "TestBrowser/1", platform: "Mac", viewport: "1440x900" });
    expect(result.value.browserContext).not.toHaveProperty("token");
  });

  it("does not infer client context from unrelated routes and rejects weak input", () => {
    expect(clientRefFromRoute(`/billing/${id}`)).toBeNull();
    expect(normaliseIssueRoute("https://example.test/private?token=x")).toBe("/unknown");
    expect(validateIssueSubmission(reportData({ description: "too short" }))).toEqual({
      ok: false,
      error: "Describe what happened in at least 15 characters.",
    });
  });

  it("allows staff to report but reserves triage for administrators", () => {
    expect(canReportIssue("Front Desk")).toBe(true);
    expect(canReportIssue("Client")).toBe(false);
    expect(canTriageIssues("Administrator")).toBe(true);
    expect(canTriageIssues("Super Admin")).toBe(true);
    expect(canTriageIssues("Manager")).toBe(false);
  });

  it("validates administrator status updates", () => {
    const data = new FormData();
    data.set("id", id);
    data.set("status", "Resolved");
    data.set("admin_note", "Confirmed fixed in the UAT verification pass.");
    expect(validateIssueTriage(data)).toEqual({
      ok: true,
      id,
      status: "Resolved",
      note: "Confirmed fixed in the UAT verification pass.",
    });
    data.set("status", "Invented");
    expect(validateIssueTriage(data)).toEqual({ ok: false, error: "Choose a valid status." });
  });
});
