import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  DOCTOR_REVIEW_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const DOCTOR_WORKFLOWS = [
  {
    key: "daily_clinical_orientation",
    label: "Daily clinical orientation",
    destinations: [
      { label: "Today", href: "/workspace?role=doctor&tab=dash", purpose: "Open the Doctor Today tab." },
      { label: "My clients", href: "/workspace?role=doctor&tab=clients", purpose: "Open the Doctor client roster." },
      { label: "Appointments", href: "/workspace?role=doctor&tab=appts", purpose: "Open the Doctor Appointments tab." },
    ],
    checks: [
      "Independently verify the current date, assignment, appointment state and ownership in the destination page.",
      "Use the existing consultation workflow for booked clinical work.",
      "The Assistant does not prioritize a patient, book or change an appointment, or claim that work is due or complete.",
    ],
  },
  {
    key: "consultation_and_emr_documentation",
    label: "Consultation and EMR documentation",
    destinations: [
      { label: "My clients", href: "/workspace?role=doctor&tab=clients", purpose: "Open the Doctor client roster." },
      { label: "Summaries", href: "/workspace?role=doctor&tab=summaries", purpose: "Open the Doctor Summaries tab." },
      { label: "EMR", href: "/emr", purpose: "Open the Doctor-owned EMR area." },
    ],
    checks: [
      "Confirm the correct permitted client and consultation before entering documentation.",
      "Record only independently reviewed clinical content through the existing clinician-owned workflow.",
      "The Assistant does not read the EMR, infer a diagnosis, interpret a result, recommend treatment, prescribe, or create a clinical note.",
    ],
  },
  {
    key: "orders_and_results_review",
    label: "Orders and results review",
    destinations: [
      { label: "Orders", href: "/orders", purpose: "Open the Doctor-visible orders area." },
      { label: "EMR", href: "/emr", purpose: "Open the Doctor-owned EMR area." },
      { label: "Resource library", href: "/workspace?role=doctor&tab=library", purpose: "Open approved role-visible resources." },
    ],
    checks: [
      "Independently confirm patient identity, order status, source, date, units, reference information and clinical context.",
      "Use the existing authorized workflow for any clinical interpretation, order or prescription decision.",
      "The Assistant does not read or interpret results, select tests, place orders, prescribe, suggest a dose, sign, approve, publish or deliver a document.",
    ],
  },
  {
    key: "safety_and_mdt_coordination",
    label: "Safety and MDT coordination",
    destinations: [
      { label: "Concerns", href: "/workspace?role=doctor&tab=concerns", purpose: "Open the Doctor Concerns tab." },
      { label: "Whiteboard", href: "/workspace?role=doctor&tab=whiteboard", purpose: "Open the shared clinical Whiteboard tab." },
      { label: "MDT board", href: "/workspace?role=doctor&tab=board", purpose: "Open the Doctor MDT board tab." },
    ],
    checks: [
      "Use the approved human-led safety and escalation workflow without relying on this checklist.",
      "Independently verify urgency, ownership, consent, minimum-necessary disclosure and required clinical follow-up.",
      "The Assistant does not assess risk, close a safety item, create or send a referral, assign work, contact anyone or replace emergency procedures.",
    ],
  },
] as const;

export type DoctorWorkflowKey = (typeof DOCTOR_WORKFLOWS)[number]["key"];
export type DoctorReviewDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: { role: "Doctor"; workflowKey: DoctorWorkflowKey; destinations: { label: string; href: string; purpose: string }[]; checks: string[] };
};

export function isDoctorWorkflowKey(value: string): value is DoctorWorkflowKey {
  return DOCTOR_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function doctorWorkflowProblem(value: string) {
  return isDoctorWorkflowKey(value) ? null : "Choose one approved Doctor workflow from the list.";
}

export function buildDoctorReviewDraft(workflowKey: DoctorWorkflowKey): DoctorReviewDraft {
  const workflow = DOCTOR_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Doctor", DOCTOR_REVIEW_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Doctor task policy is missing.");
  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`, "", "Navigation",
      ...workflow.destinations.map((destination, index) => `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`),
      "", "Clinical boundaries", ...workflow.checks.map((check, index) => `${index + 1}. ${check}`), "",
      "Independently verify the real current record, identity, permission, consent, ownership, source, clinical context, urgency and approved Cureocity workflow before taking any action.",
      "The Assistant has not inspected a client, appointment, consultation, EMR, result, order, prescription, note, concern, safety item, referral, task or handoff and cannot confirm that anything exists, is safe, is indicated, is urgent or is complete.",
    ].join("\n"),
    evidence: [
      ...workflow.destinations.map((destination) => `${destination.label} is an existing Doctor-visible destination at ${destination.href}.`),
      ...workflow.checks.map((check) => `Approved static clinical boundary: ${check}`),
    ],
    caution: "Static navigation and clinical-process orientation only. No client, medical, consultation, EMR, result, order, prescription, note, appointment, concern, safety, referral, finance, HR, staff or message record was read; nothing was diagnosed, interpreted, recommended, prescribed, ordered, changed, signed, approved, submitted, closed, assigned, delivered or sent.",
    context: {
      role: "Doctor",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
      checks: [...workflow.checks],
    },
  };
}
