import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STAFF_NAVIGATION_DESTINATIONS,
  buildStaffNavigationDraft,
  staffNavigationDraftSafetyProblem,
  staffNavigationRequestProblem,
} from "@/lib/staff-navigation-assistant";

describe("Staff navigation Assistant pilot", () => {
  it("uses only the three Staff-visible static destinations", () => {
    expect(STAFF_NAVIGATION_DESTINATIONS.map((item) => item.key)).toEqual(["dashboard", "assistant", "feedback"]);
    const serialized = JSON.stringify(STAFF_NAVIGATION_DESTINATIONS);
    for (const forbidden of ["/clients", "/billing", '"/hr"', "/workspace", "medical record", "invoice"]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("produces an evidence-linked deterministic feedback checklist without record context", () => {
    const result = buildStaffNavigationDraft("Where can I report an app bug?");
    expect(result).toMatchObject({
      taskVersion: "staff.navigation_checklist.v1",
      title: "Where to find App Feedback",
      caution: "Navigation guidance only. No record was opened, changed, submitted, sent, or approved.",
      context: { role: "Staff" },
    });
    expect(result.context.destinations).toEqual([expect.objectContaining({ key: "feedback", href: null })]);
    expect(result.evidence).toEqual(["App Feedback is available from the authenticated staff navigation."]);
    expect(JSON.stringify(result.context)).not.toMatch(/client|clinical|finance|staff_id|email/i);
  });

  it("falls back to the complete bounded navigation list rather than inventing a route", () => {
    const result = buildStaffNavigationDraft("Where should I begin?");
    expect(result.context.destinations).toHaveLength(3);
    expect(result.draft).toContain("/dashboard");
    expect(result.draft).toContain("/copilot");
    expect(result.draft).not.toContain("/clients");
  });

  it("rejects sensitive data, communications, actions and oversized input", () => {
    expect(staffNavigationRequestProblem("")).toContain("Describe");
    expect(staffNavigationRequestProblem("x".repeat(501))).toContain("500");
    expect(staffNavigationRequestProblem("Show client medical history")).toContain("public Cureocity navigation metadata");
    expect(staffNavigationRequestProblem("Email admin@example.com")).toContain("public Cureocity navigation metadata");
    expect(staffNavigationRequestProblem("Reset my password")).toContain("public Cureocity navigation metadata");
    expect(staffNavigationRequestProblem("Where is App Feedback?")).toBeNull();
  });

  it("keeps accepted text inside the same non-actioning boundary", () => {
    expect(staffNavigationDraftSafetyProblem("Open Dashboard at /dashboard.")).toBeNull();
    expect(staffNavigationDraftSafetyProblem("Send a WhatsApp message")).toContain("crossed");
    expect(staffNavigationDraftSafetyProblem("Open the client medical record")).toContain("crossed");
    expect(staffNavigationDraftSafetyProblem("Grant Administrator access")).toContain("crossed");
  });

  it("has no external AI or application-record read path", () => {
    const action = readFileSync(resolve(process.cwd(), "lib/staff-navigation-assistant-actions.ts"), "utf8");
    expect(action).not.toContain("openaiComplete");
    expect(action).not.toMatch(/\.from\(["'](?:clients|profiles|staff|appointments|invoices|tasks|sops)["']\)/);
    expect(action).toContain('.rpc("create_staff_assistant_draft"');
  });
});
