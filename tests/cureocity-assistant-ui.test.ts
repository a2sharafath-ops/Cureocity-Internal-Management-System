import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Cureocity Assistant staff UI", () => {
  it("uses the approved name in navigation and the full workspace", () => {
    expect(source("components/Sidebar.tsx")).toContain('href: "/copilot", label: "Cureocity Assistant"');
    expect(source("lib/nav-meta.ts")).toContain('{ title: "Cureocity Assistant" }');
    expect(source("app/(app)/copilot/page.tsx")).toContain(">Cureocity Assistant</h1>");
    expect(source("lib/workspaces.ts")).toContain('{ key: "copilot", label: "Cureocity Assistant" }');
  });

  it("mounts the launcher only after the staff shell excludes clients", () => {
    const layout = source("app/(app)/layout.tsx");
    const clientRedirect = layout.indexOf('if (me.role === "Client") redirect("/portal");');
    const assistantSurface = layout.indexOf("staffAssistantSurface(real, process.env)");
    expect(clientRedirect).toBeGreaterThan(-1);
    expect(assistantSurface).toBeGreaterThan(clientRedirect);
    expect(layout).toContain("<CureocityAssistantLauncher surface={assistantSurface} />");
  });

  it("implements an accessible side panel that preserves the current page", () => {
    const launcher = source("components/CureocityAssistantLauncher.tsx");
    expect(launcher).toContain('aria-haspopup="dialog"');
    expect(launcher).toContain('role="dialog"');
    expect(launcher).toContain('aria-modal="true"');
    expect(launcher).toContain('event.key === "Escape"');
    expect(launcher).toContain("launcherButton?.focus()");
    expect(launcher).toContain("Open full workspace and history");
    expect(launcher).toContain('surface.quickPromptKind === "super_admin"');
    expect(launcher).toContain('surface.quickPromptKind === "staff_navigation"');
    expect(launcher).toContain('surface.quickPromptKind === "front_desk_checklist"');
    expect(launcher).toContain('surface.quickPromptKind === "fitness_trainer_checklist"');
    expect(launcher).toContain('surface.quickPromptKind === "administrator_checklist"');
    expect(launcher).toContain('surface.quickPromptKind === "manager_checklist"');
    expect(launcher).toContain('surface.quickPromptKind === "dietitian_checklist"');
    expect(launcher).toContain("generateSuperAdminCopilotDraft");
    expect(launcher).toContain("generateStaffNavigationDraft");
    expect(launcher).toContain("generateFrontDeskOperationalDraft");
    expect(launcher).toContain("generateFitnessTrainerOperationalDraft");
    expect(launcher).toContain("generateAdministratorGovernanceDraft");
    expect(launcher).toContain("generateManagerOperationsDraft");
    expect(launcher).toContain("generateDietitianReviewDraft");
  });

  it("keeps voice explicitly disabled without microphone or recording APIs", () => {
    const launcher = source("components/CureocityAssistantLauncher.tsx");
    expect(launcher).toContain("Voice input coming soon; microphone access is disabled");
    expect(launcher).toMatch(/<button[\s\S]*?type="button"[\s\S]*?disabled[\s\S]*?CUREOCITY_ASSISTANT_VOICE_LABEL/);
    for (const unsafeVoiceApi of ["getUserMedia", "mediaDevices", "MediaRecorder", "SpeechRecognition"]) {
      expect(launcher).not.toContain(unsafeVoiceApi);
    }
  });
});
