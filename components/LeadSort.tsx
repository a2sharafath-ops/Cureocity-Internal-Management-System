"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Sort control for the leads list. Navigates by setting a `sort` query param
// while preserving every other filter already in the URL (view, stage, tier,
// search, dates, owner…), so sorting composes with filtering rather than
// resetting it. "score" is the default and carries no param, keeping URLs clean.
const OPTIONS: { key: string; label: string }[] = [
  { key: "score", label: "Score (high → low)" },
  { key: "new", label: "Newest first" },
  { key: "old", label: "Oldest first" },
  { key: "az", label: "Name A → Z" },
  { key: "za", label: "Name Z → A" },
];

export default function LeadSort({ value }: { value: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const onChange = (v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v === "score") p.delete("sort");
    else p.set("sort", v);
    const s = p.toString();
    router.push(s ? `/leads?${s}` : "/leads");
  };

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ height: 34, boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: "0 9px", fontSize: 12.5, background: "#fff", color: "var(--ink)" }}
      >
        {OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  );
}
