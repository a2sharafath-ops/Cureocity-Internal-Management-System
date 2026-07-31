import Link from "next/link";

// Shared tab bar for the front-desk hub: Overview (dashboard) + its sub-sections
// (Access & Check-in, Passes, Store) all live on their own routes but present as
// one tabbed view, so switching feels like changing a section rather than
// jumping to an unrelated page.
export type OpsTab = "overview" | "access" | "passes" | "store";

const TABS: { key: OpsTab; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/dashboard" },
  { key: "access", label: "Access & Check-in", href: "/access" },
  { key: "passes", label: "Passes", href: "/passes" },
  { key: "store", label: "Store", href: "/pos" },
];

export default function OpsTabs({ active, right }: { active: OpsTab; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              textDecoration: "none", border: "1px solid var(--border)",
              background: on ? "var(--brand-fill)" : "#fff",
              color: on ? "#fff" : "var(--muted)",
            }}
          >
            {t.label}
          </Link>
        );
      })}
      {right && <><span style={{ flex: 1 }} />{right}</>}
    </div>
  );
}
