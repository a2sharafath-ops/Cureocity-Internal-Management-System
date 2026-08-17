import {
  CUREOCITY_ASSISTANT_POLICY_VERSION,
  DIETITIAN_REVIEW_TASK_KEY,
  assistantTaskManifest,
} from "@/lib/cureocity-assistant-policy";

export const DIETITIAN_WORKFLOWS = [
  {
    key: "chart_review_readiness",
    label: "Chart review readiness",
    purpose: "Find the chart and summary areas and review the existing submission sequence without loading a client record through the Assistant.",
    destinations: [
      { label: "Diet charts", href: "/workspace?role=diet&tab=charts", purpose: "Open the Dietitian Diet charts tab." },
      { label: "Summaries", href: "/workspace?role=diet&tab=summaries", purpose: "Open the Dietitian Summaries tab." },
    ],
    checks: [
      "Save and resolve every deterministic chart problem before submitting for review.",
      "Preview the PDF and independently verify the saved chart before submission.",
      "A Dietitian submits for Medical Director review; the Assistant never approves, publishes or delivers a chart.",
    ],
  },
  {
    key: "nutrition_targets",
    label: "Nutrition targets",
    purpose: "Review the app's existing daily-target requirements without calculating or recommending a clinical target through the Assistant.",
    destinations: [
      { label: "Diet charts", href: "/workspace?role=diet&tab=charts", purpose: "Open the Dietitian Diet charts tab." },
      { label: "Dish library", href: "/workspace?role=diet&tab=dishes", purpose: "Open the costed Dish library used by chart options." },
    ],
    checks: [
      "Set a daily calorie target.",
      "Set positive minimum and maximum daily ranges for carbohydrate, protein, fat and fibre; each minimum must not exceed its maximum.",
      "Set a daily water-intake target.",
      "Use the chart's calculated daily ranges as review evidence; the Assistant does not invent or settle clinical targets.",
    ],
  },
  {
    key: "meal_option_completeness",
    label: "Meal-option completeness",
    purpose: "Review the app's existing per-slot option rules without inspecting, creating or changing a chart option through the Assistant.",
    destinations: [
      { label: "Diet charts", href: "/workspace?role=diet&tab=charts", purpose: "Open the Dietitian Diet charts tab." },
      { label: "Recipes", href: "/workspace?role=diet&tab=recipes", purpose: "Open the existing recipe workspace tab." },
      { label: "Dish library", href: "/workspace?role=diet&tab=dishes", purpose: "Open the costed Dish library used by chart options." },
    ],
    checks: [
      "Every active meal slot must contain exactly four reviewed options.",
      "Each named option needs quantity plus complete calories, carbohydrate, protein, fat and fibre values.",
      "Each named option needs a reviewed micronutrient line.",
      "Recipe-backed calculations must use approved current dishes; free-text values remain the Dietitian's responsibility.",
    ],
  },
  {
    key: "monitoring_and_handoff",
    label: "Monitoring and handoff",
    purpose: "Find the existing monitoring and team-handoff areas without reading monitoring, concern or clinical content through the Assistant.",
    destinations: [
      { label: "Meal monitoring", href: "/workspace?role=diet&tab=meals", purpose: "Open the Dietitian Meal monitoring tab." },
      { label: "Concerns", href: "/workspace?role=diet&tab=concerns", purpose: "Open the Dietitian Concerns tab." },
      { label: "MDT board", href: "/workspace?role=diet&tab=board", purpose: "Open the Dietitian MDT board tab." },
    ],
    checks: [
      "Independently verify ownership, current status and safety state in each destination.",
      "Use the approved handoff/escalation workflow when a concern requires another discipline.",
      "The Assistant does not summarize monitoring data, create a handoff, close a concern or contact anyone.",
    ],
  },
] as const;

export type DietitianWorkflowKey = (typeof DIETITIAN_WORKFLOWS)[number]["key"];

export type DietitianReviewDraft = {
  policyVersion: string;
  taskVersion: string;
  title: string;
  draft: string;
  evidence: string[];
  caution: string;
  context: {
    role: "Dietitian";
    workflowKey: DietitianWorkflowKey;
    destinations: { label: string; href: string; purpose: string }[];
    checks: string[];
  };
};

export function isDietitianWorkflowKey(value: string): value is DietitianWorkflowKey {
  return DIETITIAN_WORKFLOWS.some((workflow) => workflow.key === value);
}

export function dietitianWorkflowProblem(value: string) {
  return isDietitianWorkflowKey(value) ? null : "Choose one approved Dietitian review workflow from the list.";
}

export function buildDietitianReviewDraft(workflowKey: DietitianWorkflowKey): DietitianReviewDraft {
  const workflow = DIETITIAN_WORKFLOWS.find((item) => item.key === workflowKey);
  const manifest = assistantTaskManifest("Dietitian", DIETITIAN_REVIEW_TASK_KEY);
  if (!workflow || !manifest) throw new Error("Dietitian review task policy is missing.");
  const routeSteps = workflow.destinations.map((destination, index) => `${index + 1}. Open ${destination.label} (${destination.href}) — ${destination.purpose}`);
  const checks = workflow.checks.map((check, index) => `${index + 1}. ${check}`);
  return {
    policyVersion: CUREOCITY_ASSISTANT_POLICY_VERSION,
    taskVersion: manifest.taskVersion,
    title: `${workflow.label} checklist`,
    draft: [
      `Review this static ${workflow.label.toLowerCase()} checklist:`, "", "Navigation", ...routeSteps,
      "", "Deterministic checks", ...checks, "",
      "Independently verify the saved chart, current record state, ownership, clinical suitability and approved Cureocity workflow before doing anything in those pages.",
      "The Assistant has not inspected a client, consultation, assessment, chart, meal, recipe, concern or handoff and cannot confirm that any item exists, is safe, is eligible or is complete.",
    ].join("\n"),
    evidence: [
      ...workflow.destinations.map((destination) => `${destination.label} is an existing Dietitian-visible workspace destination at ${destination.href}.`),
      ...workflow.checks.map((check) => `Existing deterministic process rule: ${check}`),
    ],
    caution: "Static navigation and review-process orientation only. No client, clinical, consultation, assessment, chart, meal, recipe, monitoring, concern, finance, HR, staff or message record was read; nothing was calculated, recommended, prescribed, changed, submitted, approved, published, delivered or sent.",
    context: {
      role: "Dietitian",
      workflowKey,
      destinations: workflow.destinations.map(({ label, href, purpose }) => ({ label, href, purpose })),
      checks: [...workflow.checks],
    },
  };
}
