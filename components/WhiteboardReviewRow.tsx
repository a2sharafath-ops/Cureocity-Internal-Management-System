"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { answerWhiteboardAlert, markClientReviewed } from "@/lib/actions";
import { STAGE_META, type StageKey } from "@/lib/whiteboard-stage";

export type RowAlert = {
  key: string;
  kind: string;
  label: string;
  detail?: string;
  severity: "orange" | "red" | "alarm";
  discipline: string | null;
  ownerName: string;
  area: string;                // deep-link href
  why?: string | null;
  solution?: string | null;
  resolved?: boolean;
  answeredBy?: string | null;
};

export type ReviewRowData = {
  sessionId: string;
  clientId: string;
  name: string;
  code: string | null;
  age: number | null;
  stage: StageKey;
  alerts: RowAlert[];
  reviewed: boolean;
  facts: { label: string; value: string }[];
};

function SubmitBtn({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{
      border: primary ? "none" : "1px solid var(--border)", background: primary ? "var(--ink)" : "#fff",
      color: primary ? "#fff" : "var(--ink)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5,
      fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1,
    }}>{pending ? "Saving…" : children}</button>
  );
}

const SEV_META: Record<RowAlert["severity"], { bg: string; text: string }> = {
  orange: { bg: "rgba(249,115,22,0.12)", text: "#c2410c" },
  red: { bg: "rgba(220,38,38,0.10)", text: "#b91c1c" },
  alarm: { bg: "rgba(127,29,29,0.14)", text: "#7f1d1d" },
};

export default function WhiteboardReviewRow({ data, locked = false }: { data: ReviewRowData; locked?: boolean }) {
  const meta = STAGE_META[data.stage];
  const hasAlerts = data.alerts.length > 0;
  const answered = data.alerts.filter((a) => a.solution).length;
  const allAnswered = !hasAlerts || answered === data.alerts.length;
  const [open, setOpen] = useState(hasAlerts && !allAnswered);

  return (
    <div style={{ background: "var(--card)", border: `1px solid ${data.reviewed ? "var(--border)" : meta.border}`, borderLeft: `4px solid ${meta.dot}`, borderRadius: "var(--radius)", boxShadow: "var(--shadow)", opacity: data.reviewed && !hasAlerts ? 0.72 : 1 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: hasAlerts ? "pointer" : "default" }} onClick={hasAlerts ? () => setOpen((o) => !o) : undefined}>
        <span title={meta.label} style={{ width: 12, height: 12, borderRadius: 999, background: meta.dot, flexShrink: 0, boxShadow: data.stage === "alarm" ? `0 0 0 3px ${meta.bg}` : "none" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/clients/${data.clientId}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 700, fontSize: 14.5, textDecoration: "none", color: "var(--ink)" }}>{data.name}</Link>
            {data.age != null && <span style={{ color: "var(--muted)", fontSize: 12 }}>· {data.age}y</span>}
            <span style={{ background: meta.bg, color: meta.text, borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
            {data.reviewed && <span style={{ background: "rgba(22,163,74,0.12)", color: "#15803d", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>✓ Reviewed</span>}
          </div>
          {hasAlerts ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
              {data.alerts.map((a) => {
                const sm = SEV_META[a.severity];
                return <span key={a.key} style={{ background: a.solution ? "rgba(22,163,74,0.10)" : sm.bg, color: a.solution ? "#15803d" : sm.text, borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 600 }}>{a.solution ? "✓ " : ""}{a.label}</span>;
              })}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>No major alerts.</div>
          )}
        </div>
        {hasAlerts && (
          <span style={{ fontSize: 12, fontWeight: 700, color: allAnswered ? "#15803d" : "var(--red-text, #b91c1c)" }}>
            {allAnswered ? "All answered" : `${answered}/${data.alerts.length} answered`}
          </span>
        )}
        {hasAlerts && <span style={{ color: "var(--muted)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>}
      </div>

      {/* body */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "grid", gap: 12 }}>
          {/* quick facts */}
          {data.facts.length > 0 && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {data.facts.map((f) => (
                <span key={f.label} style={{ fontSize: 12, color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{f.value}</b> {f.label}</span>
              ))}
            </div>
          )}

          {data.alerts.map((a) => {
            const sm = SEV_META[a.severity];
            return (
              <div key={a.key} style={{ border: `1px solid ${a.solution ? "rgba(22,163,74,0.35)" : sm.bg}`, borderRadius: 10, padding: "10px 12px", background: a.solution ? "rgba(22,163,74,0.05)" : "var(--bg, #fafafa)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ background: sm.bg, color: sm.text, borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{a.label}</span>
                  {a.detail && <span style={{ color: "var(--muted)", fontSize: 12 }}>{a.detail}</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Assigned: <b style={{ color: "var(--ink)" }}>{a.ownerName}</b></span>
                  <Link href={a.area} style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-text)", textDecoration: "none" }}>Go to area →</Link>
                </div>

                {a.solution && (
                  <div style={{ fontSize: 12.5, marginBottom: 8 }}>
                    {a.why && <div><span style={{ color: "var(--muted)" }}>Why:</span> {a.why}</div>}
                    <div><span style={{ color: "var(--muted)" }}>Solution:</span> {a.solution}</div>
                    {a.answeredBy && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>— {a.answeredBy}</div>}
                  </div>
                )}

                {!locked && (
                  <form action={answerWhiteboardAlert} style={{ display: "grid", gap: 6 }}>
                    <input type="hidden" name="session_id" value={data.sessionId} />
                    <input type="hidden" name="client_id" value={data.clientId} />
                    <input type="hidden" name="alert_key" value={a.key} />
                    <input type="hidden" name="alert_label" value={a.label} />
                    <input type="hidden" name="discipline" value={a.discipline ?? ""} />
                    <input name="why" defaultValue={a.why ?? ""} placeholder="Why did this happen?" style={{ padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, background: "#fff" }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <input name="solution" defaultValue={a.solution ?? ""} placeholder="Solution — what will the assigned person do?" style={{ flex: 1, padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, background: "#fff" }} />
                      <SubmitBtn primary>{a.solution ? "Update" : "Save"}</SubmitBtn>
                    </div>
                  </form>
                )}
              </div>
            );
          })}

          {!locked && (
            <form action={markClientReviewed}>
              <input type="hidden" name="session_id" value={data.sessionId} />
              <input type="hidden" name="client_id" value={data.clientId} />
              <input type="hidden" name="stage" value={data.stage} />
              <input type="hidden" name="undo" value={data.reviewed ? "true" : "false"} />
              <SubmitBtn>{data.reviewed ? "Undo reviewed" : "Mark reviewed →"}</SubmitBtn>
            </form>
          )}
        </div>
      )}

      {/* compact mark-reviewed for rows with no alerts (not expandable) */}
      {!hasAlerts && !locked && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 16px" }}>
          <form action={markClientReviewed}>
            <input type="hidden" name="session_id" value={data.sessionId} />
            <input type="hidden" name="client_id" value={data.clientId} />
            <input type="hidden" name="stage" value={data.stage} />
            <input type="hidden" name="undo" value={data.reviewed ? "true" : "false"} />
            <SubmitBtn>{data.reviewed ? "Undo reviewed" : "Mark reviewed →"}</SubmitBtn>
          </form>
        </div>
      )}
    </div>
  );
}
