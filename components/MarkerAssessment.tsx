"use client";

import { useState, useTransition } from "react";
import { saveCoachAssessment } from "@/lib/actions";
import { bandFor, TONE_STYLE, type MarkerKey } from "@/lib/coach-markers";
import { INSTRUMENTS } from "@/lib/coach-instruments";

// Coach assessment form for one marker. Uses the validated instrument (auto-
// scores from item responses) or a manual score when none is defined.
export default function MarkerAssessment({ clientId, marker, tool, range }: { clientId: string; marker: MarkerKey; tool: string; range: string }) {
  const inst = INSTRUMENTS[marker];
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<Record<string, number>>({});
  const [manual, setManual] = useState("");
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();

  const computed = inst ? inst.compute(ans) : null;
  const score = inst ? computed!.score : Number(manual);
  const forceBad = inst ? Boolean(computed!.forceBad) : false;
  const hasScore = inst ? Object.keys(ans).length > 0 : manual.trim() !== "";
  const b = Number.isFinite(score) ? bandFor(marker, score) : null;
  const tone = forceBad ? "bad" : b?.tone ?? null;
  const bandLabel = forceBad ? "Positive / refer" : b?.label ?? "—";
  const ts = tone && TONE_STYLE[tone as keyof typeof TONE_STYLE] ? TONE_STYLE[tone as keyof typeof TONE_STYLE] : { bg: "var(--neutral-bg)", text: "var(--muted)" };

  const save = () => {
    if (!hasScore || !Number.isFinite(score)) return;
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("marker", marker);
    fd.set("score", String(score));
    if (forceBad) fd.set("force_bad", "1");
    if (note.trim()) fd.set("note", note.trim());
    fd.set("detail", JSON.stringify(inst ? { ...computed!.detail, answers: ans } : { manual: score }));
    start(async () => { await saveCoachAssessment(fd); setOpen(false); setAns({}); setManual(""); setNote(""); });
  };

  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px", fontSize: 12.5, background: "#fff" };

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)" }}>＋ Assess</button>;
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--bg, #fafafa)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 12.5 }}>{inst ? inst.title : `${tool} (${range})`}</b>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>✕</button>
      </div>
      {inst?.instruction && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>{inst.instruction}</div>}

      {inst ? (
        <div style={{ display: "grid", gap: 8, maxHeight: 360, overflow: "auto", paddingRight: 4 }}>
          {inst.items.map((it) => (
            <div key={it.id}>
              <div style={{ fontSize: 12, marginBottom: 3 }}>{it.text}</div>
              {it.kind === "opt" ? (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {it.options!.map((o) => {
                    const on = ans[it.id] === o.v;
                    return <button type="button" key={o.label} onClick={() => setAns((p) => ({ ...p, [it.id]: o.v }))} style={{ border: `1px solid ${on ? "var(--brand-fill)" : "var(--border)"}`, background: on ? "var(--brand-tint)" : "#fff", color: on ? "var(--brand-text)" : "var(--ink)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{o.label}</button>;
                  })}
                </div>
              ) : (
                <input type="number" min={it.min ?? 0} value={ans[it.id] ?? ""} onChange={(e) => setAns((p) => ({ ...p, [it.id]: Number(e.target.value) }))} style={{ ...inp, width: 120 }} placeholder={it.unit} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <input type="number" step="any" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={`Score (${range})`} style={{ ...inp, width: 160 }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12 }}>Score <b>{hasScore && Number.isFinite(score) ? score : "—"}</b></span>
        {hasScore && Number.isFinite(score) && <span style={{ background: ts.bg, color: ts.text, borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{bandLabel}</span>}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" style={{ ...inp, flex: 1, minWidth: 120 }} />
        <button type="button" onClick={save} disabled={busy || !hasScore} style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "6px 13px", fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy || !hasScore ? 0.6 : 1 }}>{busy ? "Saving…" : "Save assessment"}</button>
      </div>
    </div>
  );
}
