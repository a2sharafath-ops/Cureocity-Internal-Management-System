export const ISSUE_TYPES = ["Bug", "Feedback", "Performance", "Data concern"] as const;
export const ISSUE_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;
export const ISSUE_STATUSES = ["Open", "In progress", "Resolved", "Dismissed"] as const;

export const APP_FEEDBACK_COPY = {
  trigger: "App Feedback",
  title: "Cureocity App Feedback",
  scope: "Report a Cureocity app bug, technical problem, feedback, or feature request. Do not use this for client concerns or clinical or safety matters.",
} as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export type IssueSubmission = {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  route: string;
  clientRef: string | null;
  browserContext: Record<string, string | number>;
  submissionKey: string;
};

export type IssueValidation =
  | { ok: true; value: IssueSubmission }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canReportIssue(role: string): boolean {
  return Boolean(role) && role !== "Client";
}

export function canTriageIssues(role: string): boolean {
  return role === "Super Admin" || role === "Administrator";
}

export function normaliseIssueRoute(input: string): string {
  const path = input.split(/[?#]/, 1)[0].replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!path.startsWith("/")) return "/unknown";
  return path.slice(0, 500) || "/unknown";
}

export function clientRefFromRoute(route: string): string | null {
  const parts = normaliseIssueRoute(route).split("/").filter(Boolean);
  if (!["clients", "console"].includes(parts[0] ?? "")) return null;
  return UUID.test(parts[1] ?? "") ? parts[1] : null;
}

function browserContext(input: string): Record<string, string | number> {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const source = parsed as Record<string, unknown>;
    const result: Record<string, string | number> = {};
    for (const key of ["browser", "platform", "viewport"] as const) {
      const value = source[key];
      if (typeof value === "string" && value.length <= 500) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function validateIssueSubmission(formData: FormData): IssueValidation {
  const type = String(formData.get("type") ?? "");
  const severity = String(formData.get("severity") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const route = normaliseIssueRoute(String(formData.get("route") ?? ""));
  const submissionKey = String(formData.get("submission_key") ?? "").trim().slice(0, 100);

  if (!(ISSUE_TYPES as readonly string[]).includes(type)) return { ok: false, error: "Choose a valid report type." };
  if (!(ISSUE_SEVERITIES as readonly string[]).includes(severity)) return { ok: false, error: "Choose a valid severity." };
  if (description.length < 15) return { ok: false, error: "Describe what happened in at least 15 characters." };
  if (description.length > 4000) return { ok: false, error: "Keep the description under 4,000 characters." };
  if (!submissionKey) return { ok: false, error: "Refresh the page and try again." };

  return {
    ok: true,
    value: {
      type: type as IssueType,
      severity: severity as IssueSeverity,
      description,
      route,
      clientRef: clientRefFromRoute(route),
      browserContext: browserContext(String(formData.get("browser_context") ?? "")),
      submissionKey,
    },
  };
}

export function validateIssueTriage(formData: FormData):
  | { ok: true; id: string; status: IssueStatus; note: string | null }
  | { ok: false; error: string } {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("admin_note") ?? "").trim();
  if (!UUID.test(id)) return { ok: false, error: "Invalid issue report." };
  if (!(ISSUE_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Choose a valid status." };
  if (note.length > 2000) return { ok: false, error: "Keep the triage note under 2,000 characters." };
  return { ok: true, id, status: status as IssueStatus, note: note || null };
}
