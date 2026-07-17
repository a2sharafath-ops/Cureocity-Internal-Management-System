// Per-page title + subtitle, mirroring the Cureocity "Care Management"
// prototype's descriptive sub-lines. Surfaced in the top header bar.

export type PageMeta = { title: string; sub: string };

export const PAGE_META: Record<string, PageMeta> = {
  "/dashboard":     { title: "Dashboard",             sub: "Your centre at a glance — today's KPIs and activity" },
  "/leads":         { title: "CRM & Leads",           sub: "Lead scoring — HOT / WARM / COOL / COLD tiers and product match" },
  "/clients":       { title: "Clients",               sub: "CRM hub — searchable contacts and full client 360°" },
  "/appointments":  { title: "Appointment Calendar",  sub: "Calendar — consultations, assessments & follow-ups" },
  "/sessions":      { title: "Training Schedule",     sub: "PT trainer slots · fitness assessments · reschedules" },
  "/classes":       { title: "Group Classes",         sub: "Group classes · room & resource booking" },
  "/messages":      { title: "Communications",        sub: "Unified inbox — client message threads" },
  "/campaigns":     { title: "Campaigns",             sub: "Message templates & audience campaigns" },
  "/retention":     { title: "Retention",             sub: "At-risk & churn · NPS & feedback · referrals & loyalty" },
  "/pro":           { title: "Professional Workspace", sub: "Consultations — Doctor · Dietitian · Coach · Psychologist" },
  "/emr":           { title: "Patient Records",       sub: "EMR — problems · allergies · medications · vitals · encounters" },
  "/orders":        { title: "Orders & Labs",         sub: "e-Prescriptions · lab orders & results · imaging" },
  "/meals":         { title: "Meal Monitoring",       sub: "Dietitian workspace — meal logs & follow-ups" },
  "/blueprint":     { title: "BluePrint",             sub: "Blood report & 9 personalised health scores" },
  "/trainer":       { title: "Trainer Workspace",     sub: "Session board & member check-ins" },
  "/billing":       { title: "Billing",               sub: "Invoices · subscriptions & renewals · refunds · dunning" },
  "/subscriptions": { title: "Subscriptions",         sub: "Recurring plans & auto-renewals" },
  "/pos":           { title: "Passes & POS",          sub: "Gym passes · punch cards · retail point-of-sale" },
  "/claims":        { title: "Insurance",             sub: "Payers · policies · claims · pre-authorization" },
  "/reports":       { title: "Reports",               sub: "Business performance — revenue, funnel & retention" },
  "/packages":      { title: "Packages",              sub: "Bundled service packages with branch pricing" },
  "/users":         { title: "Users & Roles",         sub: "Team access — roles, permissions and RBAC" },
  "/notifications": { title: "Notifications",         sub: "Transactional email & delivery log" },
  "/audit":         { title: "Audit Log",             sub: "Every change — who did what, and when" },
  "/compliance":    { title: "Governance & Interop",  sub: "Identity · FHIR & DICOM · consent · access & retention" },
  "/account":       { title: "My Account",            sub: "Your profile & password" },
};

export function metaForPath(pathname: string): PageMeta | null {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  // longest matching prefix (for detail routes like /clients/[id], /emr/[id])
  const hit = Object.keys(PAGE_META)
    .filter((k) => pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? PAGE_META[hit] : null;
}
