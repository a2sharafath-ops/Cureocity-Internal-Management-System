import SegTabs from "@/components/SegTabs";

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
      <SegTabs active={active} items={TABS} />
    </div>
  );
}
