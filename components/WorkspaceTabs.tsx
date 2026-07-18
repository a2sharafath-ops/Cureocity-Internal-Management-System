import Link from "next/link";
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
      <Link href="/workspace" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--teal-dark)", textDecoration: "none", fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>← Back to my Workspace</Link>
      <SegTabs active={active} items={TABS} />
    </div>
  );
}
