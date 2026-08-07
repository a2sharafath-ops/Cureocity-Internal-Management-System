"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSee, isClinician, isMedicalDirector } from "@/lib/roles";
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
  // The "Care Team" hub link was removed from the sidebar. The /careteam page
  // stays live — clinicians reach its tools via My Workspace, and the workspace
  // "Integrated Dashboard" tab + BackLinks still point at it.
  //
  // Client Records and Orders & Labs went dark with it: they were only ever
  // reachable by going through a specific client, so a doctor had no way to see
  // "everything I have ordered" or open a chart without first remembering whose
  // it was. They have their own entries now. Visibility is the usual NAV_ACCESS
  // gate — Doctor, Medical Director, Administrator, Manager.
  {
    title: "Clinical",
    items: [
      { href: "/emr", label: "Client Records", icon: "🩺" },
      { href: "/orders", label: "Orders & Labs", icon: "🧪" },
    ],
  },
  {
    title: "Front Desk",
    items: [
      { href: "/leads", label: "CRM & Leads", icon: "✦" },
      { href: "/clients", label: "Clients", icon: "◉" },
      // Onboarding now lives as a tab inside the Clients section (see
      // components/ClientsTabs), so it's no longer a separate nav item.
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
      { href: "/templates", label: "Templates & Branding", icon: "🎨" },
      { href: "/notifications", label: "Email Log", icon: "✉" },
      { href: "/audit", label: "Audit Log", icon: "☰" },
      { href: "/tasks", label: "Tasks", icon: "✔" },
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
      { href: "/kb", label: "SOPs", icon: "📖" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/expenses", label: "Expenses", icon: "🧾" },
      { href: "/billing", label: "Billing", icon: "💳" },
      { href: "/subscriptions", label: "Subscriptions", icon: "🔁" },
      { href: "/finsheets", label: "Finance Sheets", icon: "📑" },
      { href: "/reports", label: "Reports", icon: "📊" },
    ],
  },
];

export default function Sidebar({ role = "Staff", logo }: { role?: string; logo?: string }) {
  const pathname = usePathname();

  // Exactly one home item survives the filter: clinicians' /dashboard redirects
  // to My Workspace, so they only get the latter; a Super Admin has no caseload,
  // so they only get the Dashboard.
  // Roles whose home IS the workspace: /dashboard only redirects there, so
  // showing it leaves a nav item that appears to do nothing when clicked.
  // The Medical Director belongs here for the same reason a clinician does.
  const clin = isClinician(role) || isMedicalDirector(role);
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
        // The gradient must span ONE VIEWPORT, not the whole document. As a
        // flex child with only `minHeight`, this stretched to the full page
        // height — so on a long page (Leads renders 100+ rows) the visible
        // top screen was just the first few percent of the ramp and read as
        // flat maroon, while short pages showed the full gradient. Pinning to
        // 100vh with alignSelf makes every page identical.
        height: "100vh",
        alignSelf: "flex-start",
        overflowY: "auto",
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
          <img src={logo || "/cureocity-mark.png?v=2"} alt="" width={19} height={19} style={{ display: "block", maxWidth: 24, maxHeight: 24 }} />
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

      {/* One rhythm the whole way down. The sections still exist — they decide
          the ORDER of the links — but they no longer add space of their own, so
          every item sits the same distance from its neighbours whether or not a
          group boundary falls between them. The 2px gap lives on the links
          themselves rather than on `nav`, otherwise a section boundary would
          quietly gain an extra gap. */}
      <nav style={{ display: "flex", flexDirection: "column" }}>
        {sections.map((section) => (
          <div key={section.title ?? "top"}>
            {/* The section labels — Front Desk, Admin, Governance, People,
                Finance — are internal shorthand for how the system is carved
                up, not names anyone on the floor uses. Only the owner sees
                them. */}
            {section.title && owner && (
              <div style={{ padding: "10px 12px 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              // The whiteboard hangs off both hubs, so it highlights whichever
              // one this role actually reaches it from.
              const WORKSPACE_ROUTES = ["/pro", "/trainer", "/meals", "/console", ...(clin ? ["/whiteboard"] : [])];
              // /emr and /orders have their own nav entries now, so they must
              // NOT also light up Care Team — two highlighted items at once
              // reads as a bug.
              const CARETEAM_ROUTES = ["/blueprint", "/exlib", "/telehealth", ...(clin ? [] : ["/whiteboard"])];
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
                    marginBottom: 2,
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
