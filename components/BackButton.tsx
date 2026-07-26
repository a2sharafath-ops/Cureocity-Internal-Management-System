"use client";

// A plain "← Back" that returns to the previous page in history. Falls back to a
// given href (or the dashboard) when there's no history to go back to — e.g. the
// page was opened in a fresh tab.
import { useRouter } from "next/navigation";

export default function BackButton({ fallback = "/dashboard", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="bp-noprint"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "#fff", color: "var(--brand-text)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
    >
      ← {label}
    </button>
  );
}
