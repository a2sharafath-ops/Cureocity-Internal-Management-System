// Read a lab report's text and summarise the markers it contains.
//
// The InBody parser works because the layout is fixed. A blood panel isn't: every
// lab formats differently. So this doesn't try to understand the document — it
// scans for well-known marker names and takes the number next to each, then says
// which are outside the usual adult reference range.
//
// Same rules as the rest of the clinical surface: report the observation, never a
// diagnosis, and say plainly that it's machine-read and unreviewed. If too little
// is recognised it returns null rather than inventing a summary.

export type MarkerHit = { key: string; label: string; value: number; unit: string; status: "low" | "normal" | "high" };

type Ref = {
  key: string; label: string; unit: string;
  /** Match the marker name. Kept tight to avoid grabbing an unrelated number. */
  re: RegExp;
  /** Usual adult range. `f` supplies a female-specific range where it differs. */
  lo?: number; hi?: number;
  f?: { lo?: number; hi?: number };
};

// Ranges are the common adult reference intervals Indian labs print. They vary
// slightly by lab, which is exactly why the output says "outside the usual range"
// rather than asserting anything is wrong.
const REFS: Ref[] = [
  { key: "glucose_f", label: "Fasting glucose", unit: "mg/dL", re: /fasting\s*(?:blood\s*)?(?:glucose|sugar)|\bFBS\b/i, lo: 70, hi: 99 },
  { key: "hba1c", label: "HbA1c", unit: "%", re: /hba1c|glycated\s*h(?:a)?emoglobin/i, hi: 5.6 },
  { key: "chol", label: "Total cholesterol", unit: "mg/dL", re: /total\s*cholesterol/i, hi: 199 },
  { key: "hdl", label: "HDL", unit: "mg/dL", re: /\bHDL\b/i, lo: 40, f: { lo: 50 } },
  { key: "ldl", label: "LDL", unit: "mg/dL", re: /\bLDL\b/i, hi: 99 },
  { key: "tg", label: "Triglycerides", unit: "mg/dL", re: /triglyceride/i, hi: 149 },
  { key: "tsh", label: "TSH", unit: "µIU/mL", re: /\bTSH\b|thyroid\s*stimulating/i, lo: 0.4, hi: 4.0 },
  { key: "vitd", label: "Vitamin D", unit: "ng/mL", re: /vitamin\s*d\b|25[\s-]*OH/i, lo: 30, hi: 100 },
  { key: "b12", label: "Vitamin B12", unit: "pg/mL", re: /\bB\s*-?\s*12\b|cobalamin/i, lo: 200, hi: 900 },
  { key: "hb", label: "Haemoglobin", unit: "g/dL", re: /\bh(?:a)?emoglobin\b|\bHb\b/i, lo: 13, hi: 17, f: { lo: 12, hi: 15 } },
  { key: "ferritin", label: "Ferritin", unit: "ng/mL", re: /ferritin/i, lo: 30, hi: 300, f: { lo: 15, hi: 200 } },
  { key: "creat", label: "Creatinine", unit: "mg/dL", re: /creatinine/i, lo: 0.7, hi: 1.3, f: { lo: 0.6, hi: 1.1 } },
  { key: "alt", label: "ALT (SGPT)", unit: "U/L", re: /\bALT\b|\bSGPT\b/i, hi: 50 },
  { key: "ast", label: "AST (SGOT)", unit: "U/L", re: /\bAST\b|\bSGOT\b/i, hi: 40 },
  { key: "crp", label: "hsCRP", unit: "mg/L", re: /hs[\s-]*CRP|c[\s-]*reactive/i, hi: 3 },
  { key: "uric", label: "Uric acid", unit: "mg/dL", re: /uric\s*acid/i, lo: 3.5, hi: 7.2, f: { lo: 2.6, hi: 6.0 } },
];

/**
 * Markers found in the report. Scans line by line: a lab prints one result per
 * line, so the first number after the marker name on that line is its value —
 * which keeps reference ranges printed alongside from being mistaken for results.
 */
export function parseReportMarkers(text: string, gender?: string | null): MarkerHit[] {
  const female = String(gender ?? "").trim().toLowerCase().startsWith("f");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const hits: MarkerHit[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    for (const r of REFS) {
      if (seen.has(r.key)) continue;
      const name = line.match(r.re);
      if (!name) continue;
      // Read from AFTER the marker name, not from where it starts — otherwise
      // digits inside the name become the result ("HbA1c" → 1, "B12" → 12).
      // Then drop a parenthetical qualifier, so "Vitamin D (25-OH) 18" is 18,
      // not 25, and "SGPT (ALT) 61" is 61.
      const after = line
        .slice((name.index ?? 0) + name[0].length)
        .replace(/^\s*\([^)]*\)/, "")
        .replace(/^\s*[:\-–]\s*/, "");
      const m = after.match(/(-?\d+(?:\.\d+)?)/);
      if (!m) continue;
      const value = Number(m[1]);
      if (!Number.isFinite(value)) continue;

      const lo = (female && r.f?.lo !== undefined) ? r.f.lo : r.lo;
      const hi = (female && r.f?.hi !== undefined) ? r.f.hi : r.hi;
      const status: MarkerHit["status"] =
        lo !== undefined && value < lo ? "low" : hi !== undefined && value > hi ? "high" : "normal";

      hits.push({ key: r.key, label: r.label, value, unit: r.unit, status });
      seen.add(r.key);
    }
  }
  return hits;
}

/** The report's own date, if it prints one. */
export function parseReportDate(text: string): string | null {
  const m = text.match(/(?:report(?:ed)?|collect(?:ed|ion)|sample|test(?:ed)?)\s*(?:date|on)?\s*:?\s*([^\n]{4,30})/i);
  const raw = m?.[1] ?? text.slice(0, 200);
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const MON: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  const dMy = raw.match(/(\d{1,2})[\s-]+([A-Za-z]{3,})\.?[\s-]+(\d{4})/);
  if (dMy) { const mm = MON[dMy[2].slice(0, 3).toLowerCase()]; if (mm) return `${dMy[3]}-${mm}-${dMy[1].padStart(2, "0")}`; }
  const dmy = raw.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);   // day-first
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

/**
 * A readable summary of the markers found. Out-of-range results lead, because
 * that's what a clinician scans for; normals are listed after so the record shows
 * what was actually tested.
 */
export function reportSummaryFromText(text: string, gender?: string | null, label?: string | null): string | null {
  const hits = parseReportMarkers(text, gender);
  if (hits.length < 2) return null;      // too little recognised to be worth showing

  const abn = hits.filter((h) => h.status !== "normal");
  const norm = hits.filter((h) => h.status === "normal");
  const fmt = (h: MarkerHit) => `${h.label} ${h.value} ${h.unit}`;

  const lines: string[] = [];
  const date = parseReportDate(text);
  lines.push(`${label || "Report"}${date ? ` (${date})` : ""}: ${hits.length} marker${hits.length === 1 ? "" : "s"} read.`);

  if (abn.length) {
    lines.push(`Outside the usual range — ${abn.map((h) => `${fmt(h)} (${h.status})`).join(" · ")}.`);
  } else {
    lines.push("All recognised markers fall within the usual adult reference ranges.");
  }
  if (norm.length) lines.push(`Within range — ${norm.map(fmt).join(" · ")}.`);

  lines.push("Auto-extracted from the uploaded report — reference ranges vary by lab; confirm against the printed report.");
  return lines.join("\n");
}
