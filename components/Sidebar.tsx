"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSee } from "@/lib/roles";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { title: string | null; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: "▚" }],
  },
  {
    title: "Front office",
    items: [
      { href: "/clients", label: "Clients", icon: "◉" },
      { href: "/leads", label: "Leads", icon: "✦" },
      { href: "/appointments", label: "Appointments", icon: "📅" },
      { href: "/messages", label: "Messages", icon: "💬" },
      { href: "/sessions", label: "Sessions", icon: "🏋" },
      { href: "/classes", label: "Group Classes", icon: "🧘" },
      { href: "/trainer", label: "Trainer", icon: "🎽" },
    ],
  },
  {
    title: "Clinical",
    items: [
      { href: "/pro", label: "Consultations", icon: "🩺" },
      { href: "/emr", label: "EMR / Charts", icon: "📋" },
      { href: "/orders", label: "Orders", icon: "🧪" },
      { href: "/meals", label: "Meal Monitoring", icon: "🍽" },
      { href: "/blueprint", label: "BluePrint", icon: "🧬" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/billing", label: "Billing", icon: "💳" },
      { href: "/subscriptions", label: "Subscriptions", icon: "🔁" },
      { href: "/pos", label: "Passes & POS", icon: "🛒" },
      { href: "/claims", label: "Insurance & Claims", icon: "🏥" },
      { href: "/packages", label: "Packages", icon: "▦" },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/retention", label: "Retention", icon: "💚" },
      { href: "/campaigns", label: "Campaigns", icon: "📣" },
      { href: "/reports", label: "Reports", icon: "📊" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/users", label: "Users & Roles", icon: "⚙" },
      { href: "/compliance", label: "Compliance", icon: "🛡" },
      { href: "/notifications", label: "Notifications", icon: "✉" },
      { href: "/audit", label: "Audit Log", icon: "☰" },
    ],
  },
];

export default function Sidebar({ role = "Staff" }: { role?: string }) {
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
                  <span style={{ width: 18, textAlign: "center", opacity: 0.9 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ position: "sticky", bottom: 0, marginTop: 20, paddingTop: 12, fontSize: 11, color: "#7fb3ab" }}>
        Cureocity Internal · v0.1
      </div>
    </aside>
  );
}
