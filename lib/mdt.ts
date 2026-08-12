export const MDT_PROGRESS = ["Green", "Amber", "Red"] as const;
export const MDT_ISSUES = [
  "None", "Medical", "Nutrition", "Exercise", "Behaviour", "Mental health",
  "Engagement", "Safety", "Logistics", "Other",
] as const;
export const MDT_BARRIERS = [
  "None", "Knowledge", "Skill", "Environment", "Time or routine", "Social support",
  "Motivation", "Confidence", "Symptoms", "Cost or access", "Other",
] as const;
export const MDT_SAFETY = ["None", "Concern", "Escalated"] as const;
export const MDT_REFERRALS = ["Not required", "Required", "Pending", "Booked", "Completed"] as const;
export const MDT_OWNER_ROLES = [
  "Health Coach", "Doctor", "Dietitian", "Fitness Trainer", "Psychologist", "Medical Director",
] as const;
export const MDT_TASK_PRIORITY = ["Routine", "Priority", "Urgent"] as const;
export const MDT_TASK_STATUS = ["Open", "In progress", "Completed", "Cancelled"] as const;

export type MdtProgress = (typeof MDT_PROGRESS)[number];
export type MdtIssue = (typeof MDT_ISSUES)[number];
export type MdtBarrier = (typeof MDT_BARRIERS)[number];
export type MdtSafety = (typeof MDT_SAFETY)[number];
export type MdtReferral = (typeof MDT_REFERRALS)[number];
export type MdtOwnerRole = (typeof MDT_OWNER_ROLES)[number];
export type MdtTaskPriority = (typeof MDT_TASK_PRIORITY)[number];
export type MdtTaskStatus = (typeof MDT_TASK_STATUS)[number];

export type MdtHuddleInput = {
  clientId: string;
  currentPlan: string;
  progressStatus: string;
  progressReason: string;
  issueCategory: string;
  newIssue: string;
  barrierCategory: string;
  barrierDetail: string;
  safetyStatus: string;
  referralStatus: string;
  ownerRole: string;
  coachNextMove: string;
  teamDecisionRequired: boolean;
  teamDecision: string;
  task: string;
  dueDate: string;
  priority: string;
};

export function mdtHuddleProblems(input: MdtHuddleInput, today: string): string[] {
  const missing: string[] = [];
  if (!input.clientId) missing.push("Client");
  if (!input.currentPlan.trim()) missing.push("Current plan");
  if (!MDT_PROGRESS.includes(input.progressStatus as MdtProgress)) missing.push("Progress status");
  if (!input.progressReason.trim()) missing.push("Objective progress reason");
  if (!MDT_ISSUES.includes(input.issueCategory as MdtIssue)) missing.push("New issue category");
  if (input.issueCategory !== "None" && !input.newIssue.trim()) missing.push("New issue detail");
  if (!MDT_BARRIERS.includes(input.barrierCategory as MdtBarrier)) missing.push("Barrier category");
  if (input.barrierCategory !== "None" && !input.barrierDetail.trim()) missing.push("Barrier detail");
  if (!MDT_SAFETY.includes(input.safetyStatus as MdtSafety)) missing.push("Safety status");
  if (!MDT_REFERRALS.includes(input.referralStatus as MdtReferral)) missing.push("Referral status");
  if (!MDT_OWNER_ROLES.includes(input.ownerRole as MdtOwnerRole)) missing.push("Today's owner");
  if (!input.coachNextMove.trim()) missing.push("Coach next move");
  if (input.teamDecisionRequired && !input.teamDecision.trim()) missing.push("Team decision needed");
  if (!input.task.trim()) missing.push("Assigned team action");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || input.dueDate < today) missing.push("Valid task due date");
  if (!MDT_TASK_PRIORITY.includes(input.priority as MdtTaskPriority)) missing.push("Task priority");
  return missing;
}

export function mdtTaskUpdateProblems(status: string, decision: string): string[] {
  if (!MDT_TASK_STATUS.includes(status as MdtTaskStatus)) return ["Valid task status"];
  if (["Completed", "Cancelled"].includes(status) && !decision.trim()) return ["Decision or outcome"];
  return [];
}
