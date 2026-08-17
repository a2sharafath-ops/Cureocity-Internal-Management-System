import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  STAFF_NAVIGATION_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const STAFF_NAVIGATION_DESTINATIONS = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    purpose: "Return to the staff home page.",
    keywords: ["dashboard", "home", "start", "landing"],
  },
  {
    key: "assistant",
    label: "Cureocity Assistant",
    href: "/copilot",
    purpose: "Open the full Assistant workspace and review your draft history.",
    keywords: ["assistant", "help", "history", "draft", "cureocity assistant"],
  },
  {
    key: "feedback",
    label: "App Feedback",
    href: null,
    purpose: "Use the App Feedback control near the bottom of the staff navigation to report a Cureocity app bug, technical problem, feedback, or feature request.",
    keywords: ["feedback", "bug", "technical", "feature", "problem", "issue"],
  },
] as const;

export type StaffNavigationDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Staff";
    destinations: { key: string; label: string; href: string | null; purpose: string }[];
  };
};

const normalize = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

const unsafeRequestPatterns = [
  /\b(client|patient|medical|clinical|diagnos|prescri|medication|lab|diet|workout|therapy)\b/i,
  /\b(invoice|payment|refund|void|salary|payroll|leave|hiring|termination|disciplin)\b/i,
  /\b(role|permission|access|password|credential|secret|token|api\s*key)\b/i,
  /\b(send|email|message|whatsapp|call|contact|notify)\b/i,
  /\b(create|update|edit|delete|remove|assign|approve|publish|submit|deploy|migrate)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?\d[\d\s().-]{7,}\d)/,
];

export function staffNavigationRequestProblem(request: string) {
  const cleaned = normalize(request, 501);
  if (!cleaned) return "Describe which part of the Cureocity app you want to find.";
  if (request.trim().length > 500) return "Keep the navigation question under 500 characters.";
  if (unsafeRequestPatterns.some((pattern) => pattern.test(cleaned))) {
    return "This Staff task can use only public Cureocity navigation metadata. Do not enter client, clinical, finance, HR, access, credential, contact, or record-change information.";
  }
  return null;
}

export function buildStaffNavigationDraft(request: string): StaffNavigationDraft {
  const cleaned = normalize(request, 500);
  const manifest = assistantTaskManifest("Staff", STAFF_NAVIGATION_TASK_KEY);
  if (!manifest) throw new Error("Staff navigation task policy is missing.");

  const lowered = cleaned.toLowerCase();
  const matched = STAFF_NAVIGATION_DESTINATIONS.filter((destination) =>
    destination.keywords.some((keyword) => lowered.includes(keyword)),
  );
  const destinations = matched.length ? matched : STAFF_NAVIGATION_DESTINATIONS;
  const contextDestinations = destinations.map(({ key, label, href, purpose }) => ({ key, label, href, purpose }));
  const steps = destinations.map((destination, index) => {
    const location = destination.href
      ? `open ${destination.label} (${destination.href})`
      : `choose ${destination.label} near the bottom of the staff navigation`;
    return `${index + 1}. ${location} — ${destination.purpose}`;
  });

  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: matched.length === 1 ? `Where to find ${matched[0].label}` : "Cureocity navigation checklist",
    draft: [
      "Review this navigation checklist before using it:",
      "",
      ...steps,
      "",
      "If none of these destinations matches what you need, ask your Cureocity administrator. This checklist does not grant access or confirm that any client, staff, or business record exists.",
    ].join("\n"),
    evidence: destinations.map((destination) =>
      `${destination.label}${destination.href ? ` is registered at ${destination.href}` : " is available from the authenticated staff navigation"}.`,
    ),
    caution: "Navigation guidance only. No record was opened, changed, submitted, sent, or approved.",
    context: {
      role: "Staff",
      destinations: contextDestinations,
    },
  };
}

export function staffNavigationDraftSafetyProblem(value: string) {
  const cleaned = normalize(value, 6001);
  if (!cleaned) return "Keep some reviewed navigation text before accepting the draft.";
  if (value.trim().length > 6000) return "Keep the reviewed navigation text under 6,000 characters.";
  if (unsafeRequestPatterns.some((pattern) => pattern.test(cleaned))) {
    return "The reviewed text crossed the Staff navigation boundary. It cannot contain client, clinical, finance, HR, access, credential, contact, or record-change content.";
  }
  return null;
}
