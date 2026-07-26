"use client";

// One clean, printable BluePrint document — the 9 scores grouped by domain, the
// overall wellness score, and the care team's consolidated summary. Used by the
// staff report page, the client card link, and the client portal, so everyone
// sees the same thing.

import { RingMeter, Gauge } from "@/components/Meters";
import { BP_SCORES, BP_DOMAINS, band, type BpScores } from "@/lib/blueprint";

const DISC_LABEL: Record<string, string> = { doctor: "Doctor", dietitian: "Dietitian", trainer: "Trainer", coach: "Coach", psychologist: "Psychologist" };

export default function BlueprintReport({
  subject, scores, consolidated, generatedDate, signoffs = [],
}: {
  subject: { name: string; code: string | null };
  scores: BpScores | null;
  consolidated: string | null;
  generatedDate: string | null;
  signoffs?: { discipline: string; by_name: string | null }[];
}) {
  const filled = BP_SCORES.filter((s) => typeof scores?.[s.key] === "number");
  const vals = filled.map((s) => Number(scores![s.key]));
  const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <style>{`@media print { .bp-noprint { display: none !important; } aside, nav { display: none !important; } }`}</style>

      <div className="bp-noprint" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => window.print()} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🖨 Print / Save PDF</button>
      </div>

      <div style={{ ...box, padding: "26px 28px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, borderBottom: "2px solid var(--border)", paddingBottom: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: "var(--brand-text)" }}>🧬 Personal Health BluePrint</div>
            <h1 style={{ fontSize: 24, margin: "4px 0 2px" }}>{subject.name}</h1>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>{subject.code ? `${subject.code} · ` : ""}{generatedDate ? `Generated ${generatedDate}` : "Draft — not yet generated"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <Gauge value={avg} size={140} unit="/ 100" label="Overall" caption={`${filled.length} of ${BP_SCORES.length} scores`} />
          </div>
        </div>

        {/* Scores by domain */}
        {filled.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 14, padding: "16px 0" }}>Health scores haven&apos;t been entered yet. Once the clinicians record the 9 scores, they appear here.</div>
        ) : (
          BP_DOMAINS.map((d) => {
            const items = BP_SCORES.filter((s) => s.domain === d.key && typeof scores?.[s.key] === "number");
            if (!items.length) return null;
            return (
              <div key={d.key} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{d.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 16, justifyItems: "center" }}>
                  {items.map((s) => {
                    const v = Number(scores![s.key]);
                    const b = band(v);
                    return (
                      <div key={s.key} style={{ textAlign: "center" }}>
                        <RingMeter value={v} size={84} stroke={9} label={s.label} />
                        <div style={{ marginTop: 4, display: "inline-block", background: b.bg, color: b.color, borderRadius: 999, padding: "1px 9px", fontSize: 10.5, fontWeight: 700 }}>{b.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Consolidated summary */}
        <div style={{ marginTop: 22, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Consolidated summary</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: consolidated ? "var(--ink)" : "var(--muted)", whiteSpace: "pre-wrap" }}>
            {consolidated || "No consolidated summary recorded."}
          </div>
        </div>

        {/* Care team sign-offs */}
        {signoffs.length > 0 && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>Signed off by</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {signoffs.map((s) => (
                <span key={s.discipline} style={{ background: "var(--green-bg)", color: "var(--green-text)", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 600 }}>
                  ✓ {DISC_LABEL[s.discipline] ?? s.discipline}{s.by_name ? ` · ${s.by_name}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
