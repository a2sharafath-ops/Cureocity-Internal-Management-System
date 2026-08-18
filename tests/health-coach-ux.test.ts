import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HEALTH_COACH_RECORD_SECTIONS,
  HEALTH_COACH_SESSION_STEPS,
  healthCoachRecordHref,
} from "@/lib/health-coach-ux";

describe("Health Coach workflow navigation", () => {
  it("keeps the client record landmarks in the intended working order", () => {
    expect(HEALTH_COACH_RECORD_SECTIONS.map((section) => section.key)).toEqual([
      "baseline", "goals", "programme", "coordination",
    ]);
    expect(new Set(HEALTH_COACH_RECORD_SECTIONS.map((section) => section.fragment)).size).toBe(4);
    expect(healthCoachRecordHref("client-1", "coaching-goals")).toBe(
      "/clients/client-1?tab=overview#coaching-goals",
    );
    expect(healthCoachRecordHref("client-1", "coaching-goals", true)).toBe(
      "/clients/client-1?tab=overview&ro=1#coaching-goals",
    );
  });

  it("keeps all five required session steps addressable without skipping SOP steps", () => {
    expect(HEALTH_COACH_SESSION_STEPS.map((step) => step.number)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(HEALTH_COACH_SESSION_STEPS.map((step) => step.fragment)).size).toBe(5);
  });

  it("uses assignment-scoped Coach shortcuts and preserves the safety-only urgent path", () => {
    const workspace = readFileSync("app/(app)/workspace/page.tsx", "utf8");
    const clients = readFileSync("components/WorkspaceClients.tsx", "utf8");
    const session = readFileSync("components/HealthCoachSessionWorkspace.tsx", "utf8");
    const clientPage = readFileSync("app/(app)/clients/[id]/page.tsx", "utf8");

    expect(workspace).toContain('href="/workspace?role=coach&tab=followups"');
    expect(workspace).not.toContain('roleKey === "coach" && <Link href="/followups"');
    expect(clients).toContain('if (role === "coach")');
    expect(clients).toContain("HEALTH_COACH_RECORD_SECTIONS.map");
    expect(session).toContain('aria-label="Health Coach session steps"');
    expect(session).toContain("!urgent || step.number === 1 || step.number === 5");
    expect(session).toContain('id={`session-step-${number}`}');

    const baseline = clientPage.indexOf("<HealthCoachBaselinePanel");
    const goals = clientPage.indexOf("<HealthCoachGoalsPanel");
    const lifecycle = clientPage.indexOf("<CoachProgrammeLifecyclePanel");
    expect(baseline).toBeGreaterThan(0);
    expect(goals).toBeGreaterThan(baseline);
    expect(lifecycle).toBeGreaterThan(goals);
  });
});
