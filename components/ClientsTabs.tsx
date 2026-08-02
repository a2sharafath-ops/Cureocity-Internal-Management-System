import Link from "next/link";

// Clients + Onboarding are the same section (nav-meta groups both under
// "clients"): the roster, and the mid-onboarding view of that roster. They read
// as one tabbed section rather than two separate nav items. Onboarding is
// Admin/Manager/Front-Desk only, so the tab hides for clinicians (who reach
// /clients but not /onboarding) — leaving a lone tab, so the bar hides itself.
export type ClientsTab = "clients" | "onboarding";

const TABS: { key: ClientsTab; label: string; href: string }[] = [
  { key: "clients", label: "Clients", href: "/clients" },
  { key: "onboarding", label: "Onboarding", href: "/onboarding" },
];

export default function ClientsTabs({ active, showOnboarding = true }: { active: ClientsTab; showOnboarding?: boolean }) {
  const tabs = TABS.filter((t) => t.key !== "onboarding" || showOnboarding);
  if (tabs.length < 2) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              display: "inline-flex", alignItems: "center", padding: "7px 14px", borderRadius: 10,
              fontSize: 13, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border)",
              background: on ? "var(--brand-fill)" : "#fff", color: on ? "#fff" : "var(--muted)",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
