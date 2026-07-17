import Link from "next/link";

// The unified "My Workspace" tab bar shared across the professional workspaces.
const TABS = [
  { key: "pro", href: "/pro", label: "🩺 Consultations" },
  { key: "trainer", href: "/trainer", label: "🎽 Trainer" },
  { key: "meals", href: "/meals", label: "🍽 Dietitian" },
  { key: "careteam", href: "/careteam", label: "🧑‍⚕️ Care Team" },
];

export default function WorkspaceTabs({ active }: { active: "pro" | "trainer" | "meals" | "careteam" }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", fontWeight: 700, marginBottom: 8 }}>My Workspace</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            border: "1px solid var(--border)",
            background: active === t.key ? "var(--teal)" : "#fff",
            color: active === t.key ? "#fff" : "var(--muted)",
          }}>{t.label}</Link>
        ))}
      </div>
    </div>
  );
}
