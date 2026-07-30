// InBody progress comparison: baseline (first record) vs latest, with the
// change per metric coloured by whether the move is in the healthy direction.
// Presentational only — no hooks — safe to render from a server component.

export type Measure = {
  date: string;
  weight?: number | null; bmi?: number | null; body_fat?: number | null;
  muscle_mass?: number | null; visceral_fat?: number | null;
  waist?: number | null; hip?: number | null; resting_hr?: number | null;
};

type Better = "down" | "up" | "none";
const METRICS: { key: keyof Measure; label: string; unit?: string; better: Better }[] = [
  { key: "weight", label: "Weight", unit: "kg", better: "none" },
  { key: "bmi", label: "BMI", better: "none" },
  { key: "body_fat", label: "Body fat", unit: "%", better: "down" },
  { key: "muscle_mass", label: "Muscle", unit: "kg", better: "up" },
  { key: "visceral_fat", label: "Visceral fat", better: "down" },
  { key: "waist", label: "Waist", unit: "cm", better: "down" },
  { key: "hip", label: "Hip", unit: "cm", better: "down" },
  { key: "resting_hr", label: "Resting HR", unit: "bpm", better: "down" },
];

const num = (v: unknown): number | null => (typeof v === "number" && !Number.isNaN(v) ? v : null);
const round = (n: number) => Math.round(n * 10) / 10;

export default function InBodyComparison({ baseline, latest }: { baseline: Measure; latest: Measure }) {
  if (baseline.date === latest.date) return null;
  const days = Math.round((new Date(latest.date).getTime() - new Date(baseline.date).getTime()) / 86400000);

  const rows = METRICS.map((m) => {
    const from = num(baseline[m.key]);
    const to = num(latest[m.key]);
    if (from === null || to === null) return null;
    const delta = round(to - from);
    const pct = from !== 0 ? round((delta / Math.abs(from)) * 100) : null;
    // Colour: green when the change is in the healthy direction, red against it.
    let tone: "good" | "bad" | "flat" = "flat";
    if (delta !== 0 && m.better !== "none") {
      const improving = m.better === "down" ? delta < 0 : delta > 0;
      tone = improving ? "good" : "bad";
    }
    return { ...m, from, to, delta, pct, tone };
  }).filter(Boolean) as { key: string; label: string; unit?: string; from: number; to: number; delta: number; pct: number | null; tone: "good" | "bad" | "flat" }[];

  if (rows.length === 0) return null;

  const color = (t: "good" | "bad" | "flat") => t === "good" ? "var(--green-text)" : t === "bad" ? "var(--red-text, #b91c1c)" : "var(--muted)";

  return (
    <div style={{ marginBottom: 14, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px" }}>Progress · initial vs latest</span>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{baseline.date} → {latest.date} · {days} day{days === 1 ? "" : "s"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ border: "1px solid var(--border)", borderRadius: 8, background: "#fff", padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.label}{r.unit ? ` (${r.unit})` : ""}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
              {r.from} <span style={{ color: "var(--muted)", fontWeight: 400 }}>→</span> {r.to}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color: color(r.tone) }}>
              {r.delta > 0 ? "▲ +" : r.delta < 0 ? "▼ " : "– "}{r.delta === 0 ? "no change" : `${r.delta}${r.pct !== null ? ` (${r.pct > 0 ? "+" : ""}${r.pct}%)` : ""}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
