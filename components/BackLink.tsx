// Care Team and workspace tools aren't in the sidebar — you reach them from a
// hub — so each needs a way back. Without this the only route out is the
// browser's back button.

import Link from "next/link";

export default function BackLink({ href = "/careteam", label = "Care Team" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        color: "var(--muted)", textDecoration: "none",
        fontSize: 12.5, fontWeight: 600, marginBottom: 12,
      }}
    >
      ← Back to {label}
    </Link>
  );
}
