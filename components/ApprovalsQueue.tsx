"use client";

import { useState } from "react";
import Link from "next/link";
import { reviewDietPlan, reviewDietAssessment } from "@/lib/actions";

/**
 * The Medical Director's sign-off queue.
 *
 * Deliberately NOT the dietitian's components. Those are built around a client
 * picker — choose a person, then see their documents — which is right for an
 * author working one client at a time and wrong for a reviewer, who has no idea
 * which clients are waiting and shouldn't have to guess. Here the documents are
 * the list and the client is an attribute of each.
 *
 * Oldest first. A queue sorted newest-first quietly buries the thing that has
 * been waiting longest, which is the one document most likely to be holding a
 * client up.
 */

// "chart" is gone — the flat diet chart was retired and the plan took its
// name. Two document kinds reach this queue now.
export type ApprovalKind = "plan" | "assess";

export type ApprovalRow = {
  kind: ApprovalKind;
  id: string;
  /** A diet chart can exist without a client attached; the others cannot. */
  clientId: string | null;
  clientName: string | null;
  version: number;
  createdAt: string;
  /** Who wrote it, where the document records that. */
  author: string | null;
  /** One line of context so the reviewer can triage without opening it. */
  summary: string | null;
  /** The printable page — what the client will actually receive. */
  readHref: string | null;
};

const LABEL: Record<ApprovalKind, string> = {
  plan: "Diet chart",
  assess: "Assessment summary",
};

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
};
const greenBtn: React.CSSProperties = {
  background: "var(--green)", color: "#fff", border: "none", borderRadius: 8,
  padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};
const plainBtn: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--border)", borderRadius: 8,
  padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  color: "var(--amber-text)", whiteSpace: "nowrap",
};
const linkBtn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  textDecoration: "none", color: "var(--ink)", whiteSpace: "nowrap",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Whole days between submission and now — what "waiting" means to a client. */
function daysWaiting(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

function WaitBadge({ days }: { days: number }) {
  if (days < 1) return <span style={{ fontSize: 11.5, color: "var(--muted)" }}>submitted today</span>;
  const urgent = days >= 2;
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: "2px 8px",
      background: urgent ? "var(--amber-bg)" : "var(--neutral-bg)",
      color: urgent ? "var(--amber-text)" : "var(--muted)",
    }}>
      waiting {days} day{days === 1 ? "" : "s"}
    </span>
  );
}

function Row({ row }: { row: ApprovalRow }) {
  const [sendingBack, setSendingBack] = useState(false);
  const days = daysWaiting(row.createdAt);

  // The chart and the two newer documents take different field names — the
  // chart predates them. Normalised here so one form serves all three.
  const action = row.kind === "plan" ? reviewDietPlan : reviewDietAssessment;
  const approveFields = <input type="hidden" name="approve" value="true" />;
  const backFields = <input type="hidden" name="approve" value="false" />;

  return (
    <div style={{ ...box, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>{row.clientName ?? "Unnamed client"}</span>
            <span style={{
              fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: "2px 8px",
              background: "var(--blue-bg)", color: "var(--blue-text)",
            }}>
              {LABEL[row.kind]}
            </span>
            <WaitBadge days={days} />
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 3 }}>
            v{row.version} · submitted {fmtDate(row.createdAt)}
            {row.author ? ` by ${row.author}` : ""}
            {row.summary ? ` · ${row.summary}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {row.readHref && (
            // Opened in a new tab on purpose: reading the document should not
            // cost the reviewer their place in the queue.
            <Link href={row.readHref} target="_blank" rel="noopener noreferrer" style={linkBtn}>
              Read document
            </Link>
          )}
          {row.clientId && (
            <Link href={`/clients/${row.clientId}`} style={{ ...linkBtn, color: "var(--muted)" }}>
              Client
            </Link>
          )}
          <button type="button" onClick={() => setSendingBack((v) => !v)} style={plainBtn}>
            {sendingBack ? "Cancel" : "Request changes"}
          </button>
          <form action={action}>
            <input type="hidden" name="id" value={row.id} />
            {approveFields}
            <button style={greenBtn}>Approve</button>
          </form>
        </div>
      </div>

      {sendingBack && (
        <form action={action} style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input type="hidden" name="id" value={row.id} />
          {backFields}
          <input
            name="note"
            autoFocus
            placeholder="What needs changing? The dietitian gets this."
            style={{
              flex: 1, minWidth: 260, border: "1px solid var(--border)",
              borderRadius: 8, padding: "0 10px", height: 36, fontSize: 13, background: "#fff",
            }}
          />
          <button style={{ ...plainBtn, height: 36 }}>Send back</button>
        </form>
      )}
    </div>
  );
}

export default function ApprovalsQueue({ rows }: { rows: ApprovalRow[] }) {
  const queue = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (queue.length === 0) {
    return (
      <div style={{ ...box, padding: "28px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
        Nothing is waiting on you. Diet charts, plans and assessment summaries appear here when the dietitian submits them.
      </div>
    );
  }

  return <div>{queue.map((r) => <Row key={`${r.kind}-${r.id}`} row={r} />)}</div>;
}
