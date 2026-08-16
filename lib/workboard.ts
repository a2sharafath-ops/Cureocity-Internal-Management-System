export const WORKBOARD_STATUSES = ["Pending", "In progress", "Done"] as const;

export const WORKBOARD_WORKSTREAMS = [
  "Product roadmap",
  "Development configuration",
  "Production readiness",
  "AWS Production migration",
  "Security & operations",
] as const;

export type WorkboardStatus = (typeof WORKBOARD_STATUSES)[number];
export type WorkboardWorkstream = (typeof WORKBOARD_WORKSTREAMS)[number];

export type WorkboardItem = {
  id: string;
  item_key: string;
  workstream: string;
  title: string;
  state_note: string;
  status: WorkboardStatus;
  next_action: string;
  sort_order: number;
  updated_at: string;
  updated_by_name: string | null;
};

export type WorkboardHistoryItem = {
  id: string;
  item_id: string;
  from_status: WorkboardStatus | null;
  to_status: WorkboardStatus;
  changed_by_name: string | null;
  changed_at: string;
  workboard_items: { title: string } | null;
};

/** Stable keys for the complete Workboard baseline through migration 0185. */
export const WORKBOARD_BASELINE = [
  { key: "app-feedback-navigation", workstream: "Product roadmap", title: "App Feedback navigation", status: "Done" },
  { key: "staff-copilot-framework", workstream: "Product roadmap", title: "Staff copilot framework", status: "Done" },
  { key: "super-admin-preview-navigation", workstream: "Product roadmap", title: "Super Admin preview navigation clarification", status: "Pending" },
  { key: "meeting-to-sprint-assistant", workstream: "Product roadmap", title: "Meeting-to-Sprint AI Assistant", status: "Pending" },

  { key: "development-environment", workstream: "Development configuration", title: "Development environment", status: "Done" },
  { key: "super-admin-copilot", workstream: "Development configuration", title: "Development Super Admin Copilot configuration", status: "In progress" },
  { key: "development-staff-accounts", workstream: "Development configuration", title: "Development staff test accounts", status: "Pending" },
  { key: "aws-setup-review", workstream: "Development configuration", title: "AWS setup docs/scripts and migration 0182 review", status: "Pending" },

  { key: "production-deployment", workstream: "Production readiness", title: "Current Vercel Production deployment", status: "Done" },
  { key: "production-staff-smoke-tests", workstream: "Production readiness", title: "Production staff role smoke tests", status: "Pending" },

  { key: "hosted-uat-decision", workstream: "AWS Production migration", title: "No-UAT Production release path decision", status: "Done" },
  { key: "aws-production-target", workstream: "AWS Production migration", title: "AWS Production target architecture and security baseline", status: "Pending" },
  { key: "production-backup-restore-rollback", workstream: "AWS Production migration", title: "Production backup, restore and rollback plan", status: "Pending" },
  { key: "production-data-storage-migration", workstream: "AWS Production migration", title: "Production database and Storage migration rehearsal", status: "Pending" },
  { key: "production-auth-staff-migration", workstream: "AWS Production migration", title: "Production Auth and staff-account migration plan", status: "Pending" },
  { key: "aws-production-app-runtime", workstream: "AWS Production migration", title: "AWS Production app runtime deployment", status: "Pending" },
  { key: "aws-production-cutover", workstream: "AWS Production migration", title: "Controlled AWS Production cutover", status: "Pending" },
  { key: "production-dns-cutover-verification", workstream: "AWS Production migration", title: "Production DNS, TLS and cutover verification", status: "Pending" },
  { key: "hosted-production-retirement", workstream: "AWS Production migration", title: "Hosted Supabase and Vercel retirement gate", status: "Pending" },

  { key: "production-secrets-inventory", workstream: "Security & operations", title: "Production secrets and API-key transfer plan", status: "Pending" },
  { key: "production-monitoring-alerts", workstream: "Security & operations", title: "AWS Production monitoring and alerts", status: "Pending" },
  { key: "development-ebs-encryption", workstream: "Security & operations", title: "Development EBS encryption decision", status: "Pending" },
  { key: "duplicate-deploy-triggers", workstream: "Security & operations", title: "Duplicate Vercel deployment trigger review", status: "Pending" },
] as const satisfies readonly {
  key: string;
  workstream: WorkboardWorkstream;
  title: string;
  status: WorkboardStatus;
}[];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canViewWorkboard(role: string): boolean {
  return role === "Super Admin";
}

export function canManageWorkboard(role: string): boolean {
  return role === "Super Admin";
}

export function validateWorkboardStatusUpdate(formData: FormData):
  | { ok: true; id: string; status: WorkboardStatus }
  | { ok: false; error: string } {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!UUID.test(id)) return { ok: false, error: "Invalid work item." };
  if (!(WORKBOARD_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, error: "Choose Pending, In progress, or Done." };
  }
  return { ok: true, id, status: status as WorkboardStatus };
}

export function missingBaselineKeys(items: Pick<WorkboardItem, "item_key">[]): string[] {
  const present = new Set(items.map((item) => item.item_key));
  return WORKBOARD_BASELINE.filter((item) => !present.has(item.key)).map((item) => item.key);
}

/**
 * Keep the 0185 category order once upgraded, while still showing legacy
 * 0184 workstream labels if code is deployed before the migration is applied.
 */
export function orderedWorkboardWorkstreams(items: Pick<WorkboardItem, "workstream">[]): string[] {
  const observed = new Set(items.map((item) => item.workstream));
  const expected = WORKBOARD_WORKSTREAMS.filter((workstream) => observed.has(workstream));
  const legacy = [...observed].filter((workstream) => !(WORKBOARD_WORKSTREAMS as readonly string[]).includes(workstream)).sort();
  return [...expected, ...legacy];
}
