"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSee, isClinician } from "@/lib/roles";
import { moduleScope } from "@/lib/deployment";

const SCOPE = moduleScope();

type NavItem = { href: string; label: string; icon: string };
type NavSection = { title: string | null; items: NavItem[] };

// Grouped to mirror the Cureocity "Care Management" prototype sidebar:
// Front Desk → Clinical → Admin → Governance → Finance.
const SECTIONS: NavSection[] = [
  // Home stands alone at the top, with no section header: the Dashboard for
  // admin/owner roles, My Workspace for clinicians (whose /dashboard redirects
  // there anyway). The filter below drops whichever one doesn't apply.
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "▚" },
      { href: "/workspace", label: "My Workspace", icon: "🧑‍⚕️" },
    ],
  },
  {
    title: "Clinical",
    items: [
      { href: "/careteam", label: "Care Team", icon: "🤝" },
    ],
  },
  {
    title: "Front Desk",
    items: [
      { href: "/leads", label: "CRM & Leads", icon: "✦" },
      { href: "/clients", label: "Clients", icon: "◉" },
      { href: "/appointments", label: "Appointment Calendar", icon: "📅" },
      { href: "/sessions", label: "Training Schedule", icon: "🏋" },
      { href: "/intake", label: "Tablet Intake", icon: "🖊" },
      { href: "/followups", label: "Follow-ups", icon: "📞" },
      { href: "/messages", label: "Communications", icon: "💬" },
      { href: "/retention", label: "Retention", icon: "💚" },
      { href: "/targets", label: "Sales Targets", icon: "🎯" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/packages", label: "Packages", icon: "▦" },
      { href: "/services", label: "Services", icon: "≣" },
      { href: "/users", label: "Users & Roles", icon: "⚙" },
      { href: "/notifications", label: "Email Log", icon: "✉" },
      { href: "/audit", label: "Audit Log", icon: "☰" },
    ],
  },
  {
    title: "Governance",
    items: [
      { href: "/compliance", label: "Governance & Interop", icon: "🛡" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/hr", label: "HR", icon: "👥" },
      { href: "/kb", label: "SOP's", icon: "📖" },
    ],
  },
  {
    title: "Sprint",
    items: [
      { href: "/tasks", label: "Tasks", icon: "✔" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/expenses", label: "Expenses", icon: "🧾" },
      { href: "/billing", label: "Billing", icon: "💳" },
      { href: "/subscriptions", label: "Subscriptions", icon: "🔁" },
      { href: "/claims", label: "Insurance", icon: "🏥" },
      { href: "/finsheets", label: "Finance Sheets", icon: "📑" },
      { href: "/reports", label: "Reports", icon: "📊" },
    ],
  },
];

export default function Sidebar({ role = "Staff" }: { role?: string }) {
  const pathname = usePathname();

  // Exactly one home item survives the filter: clinicians' /dashboard redirects
  // to My Workspace, so they only get the latter; a Super Admin has no caseload,
  // so they only get the Dashboard.
  const clin = isClinician(role);
  const owner = role === "Super Admin";
  const sections = SECTIONS
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => canSee(role, item.href)
        && !(clin && item.href === "/dashboard")
        && !(owner && item.href === "/workspace")),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <aside
      style={{
        width: 232,
        // Brand Panel gradient from the sign-in screen (Client App V3, 357:41357)
        background: "linear-gradient(135deg, #8E0E15 0%, #D62430 55%, #FB404A 100%)",
        color: "rgba(255,255,255,0.88)",
        borderRight: "none",
        minHeight: "100vh",
        padding: "18px 12px 64px",
        position: "sticky",
        top: 0,
        flexShrink: 0,
      }}
    >
      {/* Brand lockup — white tile + coral mark, wordmark, and the Ecosystem
          descriptor. Matches the sign-in screen treatment. */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 10px 20px" }}>
        <div
          style={{
            width: 34, height: 34, borderRadius: 11, background: "#fff",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}
        >
          <img src="/cureocity-mark.png" alt="" width={19} height={19} style={{ display: "block" }} />
        </div>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: "-0.2px" }}>
            Cureocity
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: 300,
              fontStyle: "italic", letterSpacing: "0.2px", marginTop: 2,
            }}
          >
            Ecosystem
          </div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sections.map((section, si) => (
          <div key={section.title ?? "top"} style={{ marginTop: si === 0 ? 0 : 14 }}>
            {section.title && (
              <div style={{ padding: "0 12px 5px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              // The whiteboard hangs off both hubs, so it highlights whichever
              // one this role actually reaches it from.
              const WORKSPACE_ROUTES = ["/pro", "/trainer", "/meals", "/console", ...(clin ? ["/whiteboard"] : [])];
              const CARETEAM_ROUTES = ["/emr", "/orders", "/blueprint", "/exlib", "/telehealth", ...(clin ? [] : ["/whiteboard"])];
              const active = pathname === item.href || pathname.startsWith(item.href + "/") ||
                (item.href === "/workspace" && WORKSPACE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) ||
                (item.href === "/careteam" && CARETEAM_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/")));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: "9px 12px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                    textDecoration: "none",
                    // on the red gradient: active is a white chip, inactive is
                    // translucent white so the gradient still reads through
                    color: active ? "#A3121B" : "rgba(255,255,255,0.88)",
                    background: active ? "#fff" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

      </nav>

      <div style={{ position: "sticky", bottom: 0, marginTop: 20, paddingTop: 12, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
        {SCOPE ? `${SCOPE.label} · pilot` : "Cureocity Internal · v0.1"}
      </div>
    </aside>
  );
}
