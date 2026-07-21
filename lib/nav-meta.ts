// Per-page title, surfaced in the top header bar.
//
// Previously carried a descriptive `sub` line too, but the header sat directly
// above each page's own h1 and intro paragraph, so it restated them.

export type PageMeta = { title: string };

export const PAGE_META: Record<string, PageMeta> = {
  "/dashboard":     { title: "Dashboard" },
  "/leads":         { title: "CRM & Leads" },
  "/clients":       { title: "Clients" },
  "/appointments":  { title: "Appointment Calendar" },
  "/sessions":      { title: "Training Schedule" },
  "/classes":       { title: "Group Classes" },
  "/messages":      { title: "Communications" },
  "/campaigns":     { title: "Campaigns" },
  "/retention":     { title: "Retention" },
  "/pro":           { title: "Professional Workspace" },
  "/emr":           { title: "Patient Records" },
  "/orders":        { title: "Orders & Labs" },
  "/meals":         { title: "Meal Monitoring" },
  "/blueprint":     { title: "BluePrint" },
  "/trainer":       { title: "Trainer Workspace" },
  "/billing":       { title: "Billing" },
  "/subscriptions": { title: "Subscriptions" },
  "/pos":           { title: "Retail Store" },
  "/passes":        { title: "Gym Passes" },
  "/claims":        { title: "Insurance" },
  "/reports":       { title: "Reports" },
  "/packages":      { title: "Packages" },
  "/users":         { title: "Users & Roles" },
  "/notifications": { title: "Notifications" },
  "/audit":         { title: "Audit Log" },
  "/compliance":    { title: "Governance & Interop" },
  "/account":       { title: "My Account" },
};

export function metaForPath(pathname: string): PageMeta | null {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  // longest matching prefix (for detail routes like /clients/[id], /emr/[id])
  const hit = Object.keys(PAGE_META)
    .filter((k) => pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? PAGE_META[hit] : null;
}
