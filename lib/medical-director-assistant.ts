import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  MEDICAL_DIRECTOR_REVIEW_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const MEDICAL_DIRECTOR_WORKFLOWS = [
  {
    key: "review_queue_orientation",
    label: "Review queue orientation",
    destinations: [
      { label: "Approvals", href: "/workspace?role=doctor&tab=approvals", purpose: "Open the Medical Director's existing clinical-document approval queue." },
      { label: "Doctor workspace", href: "/workspace?role=doctor&tab=dash", purpose: "Open the default clinical-oversight workspace." },
      { label: "Dietitian workspace", href: "/workspace?role=diet&tab=dash", purpose: "Open the diet discipline workspace for authorized oversight." },
    ],
    checks: [
      "Independently verify the real queue, document type, version, author, client identity, submission state and time waiting.",
      "Open and review the actual source document through the existing Medical Director workflow before making any decision.",
      "The Assistant does not read the queue, rank work, inspect a document, approve, reject, request changes, publish or deliver anything.",
    ],
  },
  {
    key: "evidence_completeness_review",
    label: "Evidence completeness review",
    destinations: [
      { label: "Approvals", href: "/workspace?role=doctor&tab=approvals", purpose: "Open the Medical Director's approval queue." },
      { label: "EMR", href: "/emr", purpose: "Open the Medical Director-visible EMR area." },
      { label: "Orders", href: "/orders", purpose: "Open the Medical Director-visible orders area." },
    ],
    checks: [
      "Independently verify identity, scope, source, date, units, version, authorship, required sign-offs and the governing clinical workflow.",
      "Distinguish missing evidence from conflicting evidence and record professional judgement only in the approved review workflow.",
      "The Assistant does not inspect evidence, decide completeness, interpret a result, diagnose, recommend treatment, prescribe, sign or approve.",
    ],
  },
  {
    key: "safety_escalation_governance",
    label: "Safety escalation governance",
    destinations: [
      { label: "Concerns", href: "/workspace?role=doctor&tab=concerns", purpose: "Open the Medical Director-visible Concerns tab." },
      { label: "Whiteboard", href: "/workspace?role=doctor&tab=whiteboard", purpose: "Open the shared clinical Whiteboard tab." },
      { label: "MDT board", href: "/workspace?role=doctor&tab=board", purpose: "Open the Medical Director-visible MDT board." },
    ],
    checks: [
      "Use the approved human-led safety and emergency workflow without relying on this checklist.",
      "Independently verify urgency, ownership, consent, minimum-necessary disclosure, escalation destination and required follow-up.",
      "The Assistant does not read or classify a concern, assess risk, provide crisis advice, close an event, refer, assign or contact anyone.",
    ],
  },
  {
    key: "cross_discipline_governance",
    label: "Cross-discipline governance",
    destinations: [
      { label: "Doctor workspace", href: "/workspace?role=doctor&tab=dash", purpose: "Open the Doctor discipline overview." },
      { label: "Dietitian workspace", href: "/workspace?role=diet&tab=dash", purpose: "Open the Dietitian discipline overview." },
      { label: "Health Coach quality oversight", href: "/workspace?role=coach&tab=quality", purpose: "Open the existing Health Coach quality-oversight tab." },
    ],
    checks: [
      "Independently confirm the oversight purpose, professional ownership, permitted scope and applicable approved standard.",
      "Keep operational observations separate from clinical decisions and use the accountable discipline's existing workflow.",
      "The Assistant does not compare staff or clients, score performance, infer a breach, override a clinician, change a standard, assign work or make a governance decision.",
    ],
  },
] as const;

export type MedicalDirectorWorkflowKey = (typeof MEDICAL_DIRECTOR_WORKFLOWS)[number]["key"];
export type MedicalDirectorReviewDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Medical Director";
    workflowKey: MedicalDirectorWorkflowKey;
    destinations: { label: string; href: string; purpose: string }[];
    checks: string[];
  };
};

export function isMedicalDirectorWorkflowKey(value: string): value is MedicalDirectorWorkflowKey {
  return MEDICAL_DIRECTOR_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function medicalDirectorWorkflowProblem(value: string) {
  return isMedicalDirectorWorkflowKey(value) ? null : "Choose one approved Medical Director review workflow from the list.";
}

export function buildMedicalDirectorReviewDraft(workflowKey: MedicalDirectorWorkflowKey): MedicalDirectorReviewDraft {
  const workflow = MEDICAL_DIRECTOR_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Medical Director", MEDICAL_DIRECTOR_REVIEW_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Medical Director task policy is missing.");
  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`, "", "Navigation",
      ...workflow.destinations.map((destination, index) => `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`),
      "", "Review and governance boundaries", ...workflow.checks.map((check, index) => `${index + 1}. ${check}`), "",
      "Independently verify the real record, identity, permission, consent, ownership, source, evidence, clinical context, urgency, required sign-offs and approved Cureocity workflow before taking any action.",
      "The Assistant has not inspected an approval queue, client, document, EMR, result, order, prescription, concern, safety item, staff record, standard, task or handoff and cannot confirm that anything exists, is complete, is safe, is indicated, is urgent, is compliant or is resolved.",
    ].join("\n"),
    evidence: [
      ...workflow.destinations.map((destination) => `${destination.label} is an existing Medical Director-visible destination at ${destination.href}.`),
      ...workflow.checks.map((check) => `Approved static review boundary: ${check}`),
    ],
    caution: "Static navigation, review and governance orientation only. No approval queue, client, medical, clinical, consultation, EMR, result, order, prescription, diet plan, diet assessment, therapy-note, appointment, concern, safety, referral, finance, HR, staff or message record was read; nothing was diagnosed, interpreted, recommended, prescribed, assessed, ranked, changed, approved, rejected, signed, published, delivered, closed, assigned or sent.",
    context: {
      role: "Medical Director",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
      checks: [...workflow.checks],
    },
  };
}
