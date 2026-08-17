import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  PSYCHOLOGIST_REVIEW_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const PSYCHOLOGIST_WORKFLOWS = [
  {
    key: "daily_caseload_orientation",
    label: "Daily caseload orientation",
    purpose: "Find the Psychologist's existing daily-work areas without loading a client, appointment or consultation through the Assistant.",
    destinations: [
      { label: "Today", href: "/workspace?role=psych&tab=dash", purpose: "Open the Psychologist Today tab." },
      { label: "My clients", href: "/workspace?role=psych&tab=clients", purpose: "Open the Psychologist client roster." },
      { label: "Appointments", href: "/workspace?role=psych&tab=appts", purpose: "Open the Psychologist Appointments tab." },
    ],
    checks: [
      "Independently verify the current date, assignment, appointment state and ownership in the destination page.",
      "Use the existing consultation workflow for any booked counselling work.",
      "The Assistant does not prioritize a person, book or change an appointment, or claim that work is due or complete.",
    ],
  },
  {
    key: "consultation_documentation",
    label: "Consultation documentation",
    purpose: "Review the existing documentation destinations without reading, summarizing or drafting psychological record content.",
    destinations: [
      { label: "My clients", href: "/workspace?role=psych&tab=clients", purpose: "Open the Psychologist client roster." },
      { label: "Summaries", href: "/workspace?role=psych&tab=summaries", purpose: "Open the Psychologist Summaries tab." },
      { label: "Resource library", href: "/workspace?role=psych&tab=library", purpose: "Open approved role-visible resources." },
    ],
    checks: [
      "Confirm the correct client and permitted consultation before entering documentation.",
      "Record only professionally reviewed content through the existing consultation workflow.",
      "The Assistant does not read therapy notes, infer a diagnosis, interpret a score, recommend treatment or create a clinical summary.",
    ],
  },
  {
    key: "safety_and_concern_escalation",
    label: "Safety and concern escalation",
    purpose: "Find the existing concern and team-escalation areas without reading or classifying safety content through the Assistant.",
    destinations: [
      { label: "Concerns", href: "/workspace?role=psych&tab=concerns", purpose: "Open the Psychologist Concerns tab." },
      { label: "Whiteboard", href: "/workspace?role=psych&tab=whiteboard", purpose: "Open the shared clinical Whiteboard tab." },
      { label: "MDT board", href: "/workspace?role=psych&tab=board", purpose: "Open the Psychologist MDT board tab." },
    ],
    checks: [
      "Treat any potential safety concern through the approved human-led escalation workflow without relying on this checklist.",
      "Independently verify urgency, ownership, consent, minimum-necessary disclosure and required clinical follow-up.",
      "The Assistant does not assess risk, provide crisis advice, close a safety item, create a referral, contact anyone or replace emergency procedures.",
    ],
  },
  {
    key: "blueprint_and_mdt_handoff",
    label: "BluePrint and MDT handoff",
    purpose: "Find existing cross-discipline coordination areas without reading psychological or other clinical record content.",
    destinations: [
      { label: "BluePrint", href: "/workspace?role=psych&tab=bp", purpose: "Open the Psychologist BluePrint tab." },
      { label: "Summaries", href: "/workspace?role=psych&tab=summaries", purpose: "Open the Psychologist Summaries tab." },
      { label: "MDT board", href: "/workspace?role=psych&tab=board", purpose: "Open the Psychologist MDT board tab." },
    ],
    checks: [
      "Independently verify the permitted client, purpose, ownership and minimum information required for a handoff.",
      "Separate recorded facts from professional judgement and use the existing approved coordination workflow.",
      "The Assistant does not summarize records, disclose therapy content, create a handoff, assign a task, or contact another person.",
    ],
  },
] as const;

export type PsychologistWorkflowKey = (typeof PSYCHOLOGIST_WORKFLOWS)[number]["key"];
export type PsychologistReviewDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Psychologist";
    workflowKey: PsychologistWorkflowKey;
    destinations: { label: string; href: string; purpose: string }[];
    checks: string[];
  };
};

export function isPsychologistWorkflowKey(value: string): value is PsychologistWorkflowKey {
  return PSYCHOLOGIST_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function psychologistWorkflowProblem(value: string) {
  return isPsychologistWorkflowKey(value) ? null : "Choose one approved Psychologist workflow from the list.";
}

export function buildPsychologistReviewDraft(workflowKey: PsychologistWorkflowKey): PsychologistReviewDraft {
  const workflow = PSYCHOLOGIST_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Psychologist", PSYCHOLOGIST_REVIEW_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Psychologist task policy is missing.");
  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`, "", "Navigation",
      ...workflow.destinations.map((destination, index) => `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`),
      "", "Review boundaries", ...workflow.checks.map((check, index) => `${index + 1}. ${check}`), "",
      "Independently verify the real current record, permission, consent, ownership, clinical context, urgency and approved Cureocity process before taking any action in those pages.",
      "The Assistant has not inspected a client, appointment, consultation, assessment, note, concern, safety item, referral, task or handoff and cannot confirm that anything exists, is safe, is eligible, is urgent or is complete.",
    ].join("\n"),
    evidence: [
      ...workflow.destinations.map((destination) => `${destination.label} is an existing Psychologist-visible workspace destination at ${destination.href}.`),
      ...workflow.checks.map((check) => `Approved static process boundary: ${check}`),
    ],
    caution: "Static navigation and process orientation only. No client, psychological, clinical, consultation, assessment, therapy-note, appointment, concern, safety, referral, finance, HR, staff or message record was read; nothing was diagnosed, interpreted, recommended, changed, submitted, escalated, closed, assigned, disclosed or sent.",
    context: {
      role: "Psychologist",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
      checks: [...workflow.checks],
    },
  };
}
