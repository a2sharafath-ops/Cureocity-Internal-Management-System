"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSee } from "@/lib/roles";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▚" },
  { href: "/clients", label: "Clients", icon: "◉" },
  { href: "/leads", label: "Leads", icon: "✦" },
  { href: "/sessions", label: "Sessions", icon: "🏋" },
  { href: "/trainer", label: "Trainer", icon: "🎽" },
  { href: "/packages", label: "Packages", icon: "▦" },
  { href: "/users", label: "Users & Roles", icon: "⚙" },
  { href: "/audit", label: "Audit Log", icon: "☰" },
];

export default function Sidebar({ role = "Staff" }: { role?: string }) {
  const pathname = usePathname();
  const nav = NAV.filter((item) => canSee(role, item.href));
  return (
    <aside
      style={{
        width: 232,
        background: "var(--sidebar)",
        color: "#cfe8e3",
        minHeight: "100vh",
        padding: "18px 12px",
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
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
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
      </nav>

      <div style={{ position: "absolute", bottom: 16, left: 12, right: 12, fontSize: 11, color: "#7fb3ab" }}>
        Cureocity Internal · v0.1
      </div>
    </aside>
  );
}
