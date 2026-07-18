"use client";

import { useState } from "react";
import { saveBlueprintScores } from "@/lib/actions";
import { BP_DOMAINS, BP_SCORES, band, scoresFilled, type BpScores } from "@/lib/blueprint";

export default function BlueprintScores({
  clientId, scores, canEdit,
}: { clientId: string; scores: BpScores | null; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const filled = scoresFilled(scores);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{filled}/9 scored</span>
        {canEdit && (
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>
            {open ? "Close" : filled ? "Edit scores" : "Enter scores"}
          </button>
        )}
      </div>

      {/* read-only chips */}
      {filled > 0 && !open && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
          {BP_SCORES.filter((s) => scores && typeof scores[s.key] === "number").map((s) => {
            const b = band(scores![s.key]);
            return (
              <span key={s.key} title={s.label} style={{ background: b.bg, color: b.color, borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 600 }}>
                {s.label}: {scores![s.key]}
              </span>
            );
          })}
        </div>
      )}

      {open && canEdit && (
        <form action={saveBlueprintScores} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ marginTop: 10, background: "#f8fbfa", border: "1px solid var(--border)", borderRadius: 8, padding: 12, width: 460, maxWidth: "100%" }}>
          <input type="hidden" name="client_id" value={clientId} />
          {BP_DOMAINS.map((d) => (
            <div key={d.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--muted)", marginBottom: 4 }}>{d.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BP_SCORES.filter((s) => s.domain === d.key).map((s) => (
                  <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ flex: 1 }}>{s.label}</span>
                    <input
                      type="number" name={"s_" + s.key} min={0} max={100}
                      defaultValue={scores && typeof scores[s.key] === "number" ? scores[s.key] : ""}
                      style={{ width: 64, padding: "5px 7px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>0–100, higher = healthier.</div>
          <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save scores
          </button>
        </form>
      )}
    </div>
  );
}
