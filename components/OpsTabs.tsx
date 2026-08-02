import Link from "next/link";

// Shared tab bar for the front-desk hub: Overview (dashboard) + its sub-sections
// (Access & Check-in, Passes, Store) all live on their own routes but present as
// one tabbed view, so switching feels like changing a section rather than
// jumping to an unrelated page.
export type OpsTab = "overview" | "access" | "passes" | "store";

// Access & Check-in, Passes and Store are built but not live yet — shown here so
// the roadmap is visible, but rendered inactive (greyed, not clickable) with a
// "Soon" tag. Flip `disabled` to false to switch a module on.
const TABS: { key: OpsTab; label: string; href: string; disabled?: boolean }[] = [
  { key: "overview", label: "Overview", href: "/dashboard" },
  { key: "access", label: "Access & Check-in", href: "/access", disabled: true },
  { key: "passes", label: "Passes", href: "/passes", disabled: true },
  { key: "store", label: "Store", href: "/pos", disabled: true },
];

export default function OpsTabs({ active, right }: { active: OpsTab; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {TABS.map((t) => {
        const on = t.key === active;
        const base: React.CSSProperties = {
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          border: "1px solid var(--border)",
        };
        if (t.disabled) {
          // Inactive module: not a link, muted, with a "Soon" pill.
          return (
            <span
              key={t.key}
              title="Not available yet"
              style={{ ...base, background: "var(--neutral-bg)", color: "var(--muted)", cursor: "not-allowed", opacity: 0.7 }}
            >
              {t.label}
              <span style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 999, padding: "0 7px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px" }}>Soon</span>
            </span>
          );
        }
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{ ...base, textDecoration: "none", background: on ? "var(--brand-fill)" : "#fff", color: on ? "#fff" : "var(--muted)" }}
          >
            {t.label}
          </Link>
        );
      })}
      {right && <><span style={{ flex: 1 }} />{right}</>}
    </div>
  );
}
