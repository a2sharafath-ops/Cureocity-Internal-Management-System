"use client";

// The search box on CRM & Leads. Keeps the query in the URL so a filtered view
// is shareable and survives the Realtime refresh, but debounces the push so
// typing doesn't fire a server round-trip per keystroke at 998 rows.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LeadSearch({
  initial,
  params,
  count,
}: {
  initial: string;
  /** the other active filters, preserved on every search */
  params: { view?: string; stage?: string; tier?: string };
  /** matches for the current query — null when nothing is being searched */
  count: number | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  // Don't fight the URL while the user is mid-word: only accept an external
  // change (Clear filters, back button) when it differs from what we pushed.
  const pushed = useRef(initial);

  useEffect(() => {
    if (initial !== pushed.current) {
      pushed.current = initial;
      setQ(initial);
    }
  }, [initial]);

  useEffect(() => {
    if (q === pushed.current) return;
    const t = setTimeout(() => {
      pushed.current = q;
      const p = new URLSearchParams();
      if (params.view && params.view !== "all") p.set("view", params.view);
      if (params.stage) p.set("stage", params.stage);
      if (params.tier) p.set("tier", params.tier);
      if (q.trim()) p.set("q", q.trim());
      const s = p.toString();
      router.replace(s ? `/leads?${s}` : "/leads", { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [q, params.view, params.stage, params.tier, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ position: "relative", flex: 1, maxWidth: 380, minWidth: 220 }}>
        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" }}>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
          placeholder="Search by name or phone number"
          aria-label="Search leads by name or phone number"
          style={{
            width: "100%", padding: "9px 30px 9px 32px", fontSize: 14,
            border: "1px solid var(--border)", borderRadius: 10,
            outline: "none", background: "#fff",
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--muted)", fontSize: 14, lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        )}
      </div>
      {count !== null && (
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {count === 0
            ? "No leads match that name or number"
            : `${count} match${count === 1 ? "" : "es"}`}
        </span>
      )}
    </div>
  );
}
