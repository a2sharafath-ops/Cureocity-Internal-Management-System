"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSee } from "@/lib/roles";
import { setPreviewRole } from "@/lib/actions";
import { PERSONAS } from "@/lib/personas";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { title: string | null; items: NavItem[] };

// Grouped to mirror the Cureocity "Care Management" prototype sidebar:
// Front Desk → Clinical → Admin → Governance → Finance.
const SECTIONS: NavSection[] = [
  {
    title: "Front Desk",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "▚" },
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
    title: "Workspaces",
    items: [
      { href: "/careteam", label: "Care Team Hub", icon: "🧑‍⚕️" },
      { href: "/pro", label: "Consultations", icon: "🩺" },
      { href: "/telehealth", label: "Telehealth", icon: "📹" },
      { href: "/emr", label: "Patient Records", icon: "📋" },
      { href: "/orders", label: "Orders & Labs", icon: "🧪" },
      { href: "/meals", label: "Meal Monitoring", icon: "🍽" },
      { href: "/blueprint", label: "BluePrint", icon: "🧬" },
      { href: "/trainer", label: "Trainer", icon: "🎽" },
      { href: "/exlib", label: "Exercise Library", icon: "🏃" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/packages", label: "Packages", icon: "▦" },
      { href: "/services", label: "Services", icon: "≣" },
      { href: "/users", label: "Users & Roles", icon: "⚙" },
      { href: "/notifications", label: "Notifications", icon: "✉" },
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

export default function Sidebar({ role = "Staff", canPersona = false }: { role?: string; canPersona?: boolean }) {
  const pathname = usePathname();

  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((item) => canSee(role, item.href)) }))
    .filter((s) => s.items.length > 0);

  return (
    <aside
      style={{
        width: 232,
        background: "var(--sidebar)",
        color: "#cfe8e3",
        minHeight: "100vh",
        padding: "18px 12px 64px",
        position: "sticky",
        top: 0,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px 18px" }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 9, background: "#fff",
            color: "var(--sidebar)", display: "grid", placeItems: "center", fontWeight: 800,
          }}
        >
          ✚
        </div>
        <b style={{ color: "#fff", fontSize: 16 }}>Cureocity</b>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sections.map((section, si) => (
          <div key={section.title ?? "top"} style={{ marginTop: si === 0 ? 0 : 14 }}>
            {section.title && (
              <div style={{ padding: "0 12px 5px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "#6ea69d" }}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
                    color: active ? "#fff" : "#cfe8e3",
                    background: active ? "var(--sidebar-hover)" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        {canPersona && (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: "0 12px 5px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".7px", textTransform: "uppercase", color: "#6ea69d" }}>
              Workspaces
            </div>
            {PERSONAS.map((p) => {
              const active = pathname.startsWith(p.route);
              return (
                <form key={p.key} action={setPreviewRole}>
                  <input type="hidden" name="role" value={p.key} />
                  <button
                    type="submit"
                    title={`Enter the ${p.label} workspace`}
                    style={{
                      display: "flex", alignItems: "center", gap: 11, width: "100%",
                      padding: "9px 12px", borderRadius: 10, fontSize: 14, fontWeight: active ? 700 : 500,
                      border: "none", cursor: "pointer", textAlign: "left",
                      color: active ? "#fff" : "#cfe8e3", background: active ? "var(--sidebar-hover)" : "transparent",
                    }}
                  >
                    {p.label} Workspace
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </nav>

      <div style={{ position: "sticky", bottom: 0, marginTop: 20, paddingTop: 12, fontSize: 11, color: "#7fb3ab" }}>
        Cureocity Internal · v0.1
      </div>
    </aside>
  );
}
