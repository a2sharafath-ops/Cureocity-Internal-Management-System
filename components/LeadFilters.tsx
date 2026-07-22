"use client";

// Search + advanced filters for CRM & Leads.
//
// The search box stays exactly as it was — live and debounced, filtering as you
// type. The date and follow-up filters, which are used far less often, move
// behind an "Advanced search" disclosure so the default view is just a search
// box.
//
// Two details that matter more than they look:
//
//  1. The panel opens by default when a filter is already applied (arriving on
//     a shared/bookmarked URL). Landing on a filtered list with the controls
//     hidden is how someone concludes the data is missing.
//  2. The toggle carries a count badge when filters are active, so a collapsed
//     panel never silently hides why the list is short.

import { useState } from "react";
import Link from "next/link";
import LeadSearch from "./LeadSearch";

export default function LeadFilters({
  q, from, to, due, view, stage, tier, owner, owners, count, clearHref,
}: {
  q: string;
  from: string;
  to: string;
  due: string;
  view: string;
  stage?: string;
  tier?: string;
  /** currently selected owner staff id, "none" for unowned, or "" for any */
  owner: string;
  /** owners offered in the dropdown */
  owners: { id: string; name: string }[];
  count: number | null;
  clearHref: string;
}) {
  const activeCount = (from || to ? 1 : 0) + (due ? 1 : 0) + (owner ? 1 : 0);
  const [open, setOpen] = useState(activeCount > 0);

  const label: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, letterSpacing: ".6px",
    textTransform: "uppercase", color: "var(--muted)", marginBottom: 5,
  };
  const field: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 8, padding: "0 9px",
    fontSize: 12.5, background: "#fff",
    // A native <select> and an <input type="date"> do NOT share an intrinsic
    // height, so flex-end aligned their bottoms while their labels sat at
    // different heights. Fixing the height removes the discrepancy entirely.
    height: 34, boxSizing: "border-box",
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <LeadSearch
        initial={q}
        params={{ view, stage, tier }}
        count={count}
        trailing={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="advanced-search"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              border: "1px solid var(--border)",
              background: open ? "var(--neutral-bg)" : "#fff",
              borderRadius: 10, padding: "9px 13px", fontSize: 13,
              fontWeight: 600, cursor: "pointer", color: "var(--text)",
              whiteSpace: "nowrap",
            }}
          >
            Advanced search
            {activeCount > 0 && (
              <span style={{
                background: "var(--brand-fill)", color: "#fff", borderRadius: 999,
                minWidth: 17, height: 17, fontSize: 10.5, fontWeight: 700,
                display: "grid", placeItems: "center", padding: "0 5px",
              }}>
                {activeCount}
              </span>
            )}
            <span style={{ fontSize: 10, color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
          </button>
        }
      />

      {open && (
        <form
          method="get"
          id="advanced-search"
          style={{
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            background: "var(--card)", padding: "14px 16px", marginTop: 10,
            display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end",
          }}
        >
          {/* the search term and the tab/chip filters survive an Apply */}
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          {stage && <input type="hidden" name="stage" value={stage} />}
          {tier && <input type="hidden" name="tier" value={tier} />}
          {q && <input type="hidden" name="q" value={q} />}

          <div>
            <div style={label}>Lead added dates</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="date" name="from" defaultValue={from} aria-label="Lead added from" style={field} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>to</span>
              <input type="date" name="to" defaultValue={to} aria-label="Lead added to" style={field} />
            </div>
          </div>

          <div>
            <div style={label}>Follow-up day</div>
            <select name="due" defaultValue={due} aria-label="Follow-up day" style={{ ...field, minWidth: 168 }}>
              <option value="">Any</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">Due in next 7 days</option>
              <option value="none">None scheduled</option>
            </select>
          </div>

          <div>
            <div style={label}>Owner</div>
            <select name="owner" defaultValue={owner} aria-label="Owner" style={{ ...field, minWidth: 168 }}>
              <option value="">Anyone</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="none">— Unowned —</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
            {activeCount > 0 && (
              <Link href={clearHref} style={{ color: "var(--brand-text)", fontSize: 12.5, textDecoration: "none", fontWeight: 600 }}>
                Clear filters
              </Link>
            )}
            <button type="submit" style={{
              border: "1px solid var(--brand-fill)", background: "var(--brand-fill)",
              color: "#fff", borderRadius: 8, padding: "0 16px",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              height: 34, boxSizing: "border-box",
            }}>
              Apply
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ ...field, fontWeight: 600, cursor: "pointer", padding: "0 14px" }}
            >
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
