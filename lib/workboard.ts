export const WORKBOARD_STATUSES = ["Pending", "In progress", "Done"] as const;

export type WorkboardStatus = (typeof WORKBOARD_STATUSES)[number];

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

/** Stable keys for the approved sprint baseline seeded by migration 0184. */
export const WORKBOARD_BASELINE = [
  { key: "app-feedback-navigation", title: "App Feedback navigation", status: "Done" },
  { key: "staff-copilot-framework", title: "Staff copilot framework", status: "Done" },
  { key: "super-admin-copilot", title: "Super Admin copilot", status: "In progress" },
  { key: "development-environment", title: "Development environment", status: "Done" },
  { key: "production-deployment", title: "Production deployment", status: "Done" },
  { key: "production-staff-smoke-tests", title: "Production staff-readiness smoke tests", status: "Pending" },
  { key: "development-staff-accounts", title: "Development staff test accounts", status: "Pending" },
  { key: "super-admin-preview-navigation", title: "Super Admin preview navigation clarification", status: "Pending" },
  { key: "hosted-uat-decision", title: "Hosted UAT decision", status: "Pending" },
  { key: "aws-setup-review", title: "AWS setup docs/scripts review and separate commit", status: "Pending" },
  { key: "duplicate-deploy-triggers", title: "Duplicate deployment triggers review", status: "Pending" },
  { key: "meeting-to-sprint-assistant", title: "Meeting-to-Sprint AI Assistant", status: "Pending" },
] as const satisfies readonly { key: string; title: string; status: WorkboardStatus }[];

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
