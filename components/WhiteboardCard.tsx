"use client";

// One client on the daily board. Collapsed it's a headline; expanded it shows
// the same dataset BluePrint reads from, plus the controls to adjust the
// working interpretation and capture what the team decided.

import { useState } from "react";
import Link from "next/link";
import { band } from "@/lib/blueprint";
import type { ScoreTweaks } from "@/lib/whiteboard";
import {
  setWhiteboardCardStatus, tweakWhiteboardScore, addWhiteboardNote,
  toggleWhiteboardNote, removeWhiteboardCard,
} from "@/lib/actions";

export type ScoreRow = {
  key: string; label: string; domain: string;
  baseline: number | null; value: number | null; delta: number | null; note: string | null;
};
export type Note = {
  id: string; kind: string; body: string; discipline: string | null;
  author: string | null; due_date: string | null; done: boolean; owner_id: string | null;
};
export type CardData = {
  id: string;
  clientId: string;
  name: string;
  code: string | null;
  age: number | null;
  reason: string | null;
  origin: string;
  status: string;
  headline: string | null;
  tweaks: ScoreTweaks;
  scores: ScoreRow[];
  notes: Note[];
  facts: { label: string; value: string }[];
  blueprintGenerated: boolean;
};

const KIND = {
  insight: { label: "Insight", bg: "#e0f2f1", color: "var(--teal-dark)" },
  action: { label: "Action", bg: "var(--amber-bg)", color: "#92400e" },
  concern: { label: "Concern", bg: "var(--red-bg)", color: "#991b1b" },
} as const;

const STATUS = {
  pending: { label: "To discuss", bg: "#eef2f1", color: "var(--muted)" },
  discussed: { label: "Discussed", bg: "var(--green-bg)", color: "#166534" },
  deferred: { label: "Deferred", bg: "var(--amber-bg)", color: "#92400e" },
} as const;

const input: React.CSSProperties = { padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };

export default function WhiteboardCard({ card, staff, locked }: {
  card: CardData;
  staff: { id: string; name: string }[];
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const st = STATUS[card.status as keyof typeof STATUS] ?? STATUS.pending;
  const changed = card.scores.filter((s) => s.delta != null && s.delta !== 0);
  const actions = card.notes.filter((n) => n.kind === "action");
  const openActions = actions.filter((n) => !n.done).length;

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <button type="button" onClick={() => setOpen((o) => !o)}
          style={{ ...btn, border: "none", background: "transparent", padding: 0, flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--muted)" }}>›</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b style={{ fontSize: 14 }}>{card.name}</b>
              <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{card.code}{card.age != null ? ` · ${card.age} yrs` : ""}</span>
              <span style={{ background: st.bg, color: st.color, borderRadius: 999, padding: "1px 9px", fontSize: 10.5, fontWeight: 700 }}>{st.label}</span>
              {card.origin === "flagged" && <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>auto</span>}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {card.headline || card.reason || "No reason recorded"}
            </div>
          </div>
        </button>

        {changed.length > 0 && (
          <span style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
            {changed.length} adjusted
          </span>
        )}
        {openActions > 0 && (
          <span style={{ background: "var(--amber-bg)", color: "#92400e", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
            {openActions} action{openActions === 1 ? "" : "s"}
          </span>
        )}
        <Link href={`/clients/${card.clientId}`} style={{ ...btn, textDecoration: "none", color: "var(--teal-dark)", whiteSpace: "nowrap" }}>360° →</Link>
      </div>

      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* ---- left: the data the team is looking at ---- */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>At a glance</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
              {card.facts.map((f) => (
                <div key={f.label} style={{ background: "var(--bg)", borderRadius: 8, padding: "6px 9px" }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{f.label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>Health scores</span>
              <span style={{ color: "var(--muted)", fontSize: 11 }}>
                {card.blueprintGenerated ? "BluePrint baseline · click to adjust" : "no BluePrint yet"}
              </span>
            </div>

            {card.scores.map((s) => {
              const b = band(s.value);
              const isEditing = editing === s.key;
              return (
                <div key={s.key} style={{ borderTop: "1px solid var(--border)", padding: "6px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                    {s.delta != null && s.delta !== 0 && (
                      <span style={{ color: s.delta > 0 ? "#166534" : "#991b1b", fontSize: 11, fontWeight: 700 }}>
                        {s.delta > 0 ? "▲" : "▼"} {Math.abs(s.delta)}
                      </span>
                    )}
                    <span style={{ background: b.bg, color: b.color, borderRadius: 999, padding: "1px 9px", fontSize: 10.5, fontWeight: 700, minWidth: 44, textAlign: "center" }}>
                      {s.value ?? "—"}
                    </span>
                    {!locked && (
                      <button type="button" onClick={() => setEditing(isEditing ? null : s.key)} style={{ ...btn, padding: "3px 8px", fontSize: 11 }}>
                        {isEditing ? "Cancel" : "Adjust"}
                      </button>
                    )}
                  </div>

                  {s.note && !isEditing && (
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, fontStyle: "italic" }}>{s.note}</div>
                  )}

                  {isEditing && (
                    <form action={tweakWhiteboardScore} style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                      <input type="hidden" name="id" value={card.id} />
                      <input type="hidden" name="key" value={s.key} />
                      <input name="score" type="number" min={0} max={100} defaultValue={s.value ?? ""} placeholder="0–100" style={{ ...input, width: 84 }} />
                      <input name="note" defaultValue={s.note ?? ""} placeholder="why the team moved it" style={input} />
                      <button type="submit" style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none", whiteSpace: "nowrap" }}>Save</button>
                    </form>
                  )}
                </div>
              );
            })}
            {s_baselineHint(card)}
          </div>

          {/* ---- right: what the team decided ---- */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Discussion</div>

            {card.notes.length ? card.notes.map((n) => {
              const k = KIND[n.kind as keyof typeof KIND] ?? KIND.insight;
              return (
                <div key={n.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "7px 0", borderTop: "1px solid var(--border)" }}>
                  <span style={{ background: k.bg, color: k.color, borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>{k.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, textDecoration: n.done ? "line-through" : "none", color: n.done ? "var(--muted)" : "inherit" }}>{n.body}</div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 1 }}>
                      {n.author ?? "—"}{n.discipline ? ` · ${n.discipline}` : ""}{n.due_date ? ` · due ${n.due_date}` : ""}
                    </div>
                  </div>
                  {n.kind === "action" && !locked && (
                    <form action={toggleWhiteboardNote}>
                      <input type="hidden" name="id" value={n.id} />
                      <input type="hidden" name="done" value={String(n.done)} />
                      <button type="submit" style={{ ...btn, padding: "3px 8px", fontSize: 11 }}>{n.done ? "Reopen" : "Done"}</button>
                    </form>
                  )}
                </div>
              );
            }) : <div style={{ color: "var(--muted)", fontSize: 12.5, padding: "6px 0" }}>Nothing captured yet.</div>}

            {!locked && (
              <form action={addWhiteboardNote} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <input type="hidden" name="card_id" value={card.id} />
                <textarea name="body" rows={2} placeholder="What did the team conclude?" style={{ ...input, resize: "vertical" }} required />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <select name="kind" defaultValue="insight" style={{ ...input, width: 110 }}>
                    <option value="insight">Insight</option>
                    <option value="action">Action</option>
                    <option value="concern">Concern</option>
                  </select>
                  <select name="owner_id" defaultValue="" style={{ ...input, width: 150 }}>
                    <option value="">— owner —</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input name="due_date" type="date" style={{ ...input, width: 150 }} />
                  <button type="submit" style={{ ...btn, background: "var(--ink)", color: "#fff", border: "none" }}>Add</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  A concern also lands on the client&apos;s file for the owning discipline.
                </div>
              </form>
            )}

            {!locked && (
              <form action={setWhiteboardCardStatus} style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <input type="hidden" name="id" value={card.id} />
                <input name="headline" defaultValue={card.headline ?? ""} placeholder="One-line takeaway for the record" style={input} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit" name="status" value="discussed" style={{ ...btn, background: "var(--teal)", color: "#fff", border: "none" }}>Mark discussed</button>
                  <button type="submit" name="status" value="deferred" style={btn}>Defer</button>
                  <span style={{ flex: 1 }} />
                </div>
              </form>
            )}

            {!locked && (
              <form action={removeWhiteboardCard} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={card.id} />
                <button type="submit" style={{ ...btn, border: "none", background: "transparent", color: "var(--muted)", padding: 0, fontSize: 11.5 }}>
                  Remove from board
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Reminder that adjustments never rewrite the signed-off document. */
function s_baselineHint(card: CardData) {
  const changed = card.scores.filter((s) => s.delta != null && s.delta !== 0);
  if (!changed.length) return null;
  return (
    <div style={{ marginTop: 10, background: "var(--bg)", borderRadius: 8, padding: "8px 10px", fontSize: 11.5, color: "var(--muted)" }}>
      {changed.length} score{changed.length === 1 ? "" : "s"} adjusted for today. The signed-off BluePrint is unchanged —
      these are the team&apos;s working figures, kept as a dated record.
    </div>
  );
}
