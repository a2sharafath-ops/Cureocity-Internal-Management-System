"use client";

import { useMemo, useState, useTransition } from "react";
import { saveLabResult, deleteLabResult } from "@/lib/actions";
import { LAB_MARKERS, readValue, markerFor, type LabResult } from "@/lib/lab-results";

/**
 * Typing a blood report in, next to the report itself.
 *
 * This sits under Medical reports in the consultation console because that is
 * where the PDF is open. Somebody reads a line off it and types it here; the
 * report stays the record and this is a reading of it.
 *
 * WHY IT IS A FORM AND NOT AN EXTRACTOR
 *
 * The reports arrive as scans as often as text, from a dozen laboratories with
 * a dozen layouts, and a machine reading "1.2" off the wrong row of a table is
 * a wrong number that looks exactly like a right one. Twelve figures typed by
 * somebody with the report in front of them takes two minutes and is checkable.
 *
 * WHAT IT SHOWS BACK
 *
 * A verdict, immediately, as she types — low, in range, high — against the
 * range on the report where she has entered one and a published range where she
 * has not. Seeing "low" appear is how a mistyped decimal point gets caught in
 * the second it is made rather than on a chart three weeks later.
 */

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
};
const inp: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "0 9px",
  height: 32, fontSize: 12.5, background: "#fff", boxSizing: "border-box", width: "100%",
};
const ghost: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const darkBtn: React.CSSProperties = {
  background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8,
  padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};

type Row = LabResult & { id: string; panel: string | null; notes: string | null; entered_by: string | null };

const today = () => new Date().toISOString().slice(0, 10);

const tone = (v: string) =>
  v === "low" ? { bg: "var(--amber-bg)", fg: "var(--amber-text)" }
  : v === "high" ? { bg: "var(--amber-bg)", fg: "var(--amber-text)" }
  : v === "in range" ? { bg: "var(--green-bg)", fg: "var(--green-text)" }
  : { bg: "var(--card)", fg: "var(--muted)" };

export default function LabResults({ clientId, results, canEdit }: {
  clientId: string;
  results: Row[];
  canEdit: boolean;
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // One date for the whole panel: a report is one document with one date on it,
  // and typing it twelve times is twelve chances to fumble a digit.
  const [takenOn, setTakenOn] = useState(today());
  const [panel, setPanel] = useState("");
  const [draft, setDraft] = useState<Record<string, { value: string; low: string; high: string }>>({});

  const shown = useMemo(
    () => [...results].sort((a, b) => (a.taken_on < b.taken_on ? 1 : a.taken_on > b.taken_on ? -1 : 0)),
    [results],
  );

  const set = (key: string, patch: Partial<{ value: string; low: string; high: string }>) =>
    setDraft((d) => ({
      ...d,
      [key]: { ...{ value: "", low: "", high: "" }, ...d[key], ...patch },
    }));

  /** What the verdict would be for a figure she is part way through typing. */
  const preview = (key: string) => {
    const d = draft[key];
    const m = markerFor(key)!;
    if (!d?.value.trim()) return null;
    const n = Number(d.value);
    if (!Number.isFinite(n)) return null;
    return readValue({
      marker: key, label: null, value: n, unit: m.unit,
      low: d.low.trim() === "" ? null : Number(d.low),
      high: d.high.trim() === "" ? null : Number(d.high),
      taken_on: takenOn,
    });
  };

  const filled = Object.entries(draft).filter(([, d]) => d.value.trim() !== "");

  const saveAll = () => {
    setErr(null);
    start(async () => {
      for (const [key, d] of filled) {
        const m = markerFor(key)!;
        const fd = new FormData();
        fd.set("client_id", clientId);
        fd.set("marker", key);
        fd.set("label", m.label);
        fd.set("value", d.value.trim());
        fd.set("unit", m.unit);
        fd.set("low", d.low.trim());
        fd.set("high", d.high.trim());
        fd.set("taken_on", takenOn);
        fd.set("panel", panel.trim());
        const r = await saveLabResult(fd);
        // Stop on the first failure rather than pressing on: the rest of the
        // panel is almost certainly wrong the same way, and a half-saved report
        // is harder to reason about than one that plainly did not save.
        if (r?.error) { setErr(`${m.label}: ${r.error}`); return; }
      }
      setDraft({});
      setAdding(false);
    });
  };

  const remove = (id: string) => {
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await deleteLabResult(fd);
      if (r?.error) setErr(r.error);
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--muted)", flex: 1, minWidth: 200 }}>
          Values typed from a report. The report itself stays above and remains the record —
          this is what the diet chart can read.
        </div>
        {canEdit && !adding && (
          <button type="button" style={darkBtn} onClick={() => setAdding(true)}>+ Enter a report</button>
        )}
      </div>

      {err && (
        <div style={{ fontSize: 12.5, color: "var(--amber-text)", background: "var(--amber-bg)",
                      border: "1px solid var(--border)", borderRadius: 8, padding: "8px 11px", marginBottom: 10 }}>
          {err}
        </div>
      )}

      {/* ---- ENTERING A REPORT ------------------------------------------- */}
      {adding && canEdit && (
        <div style={{ ...box, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>
              Date on the report
              <input type="date" value={takenOn} max={today()}
                onChange={(e) => setTakenOn(e.target.value)}
                style={{ ...inp, marginTop: 4, width: 160 }} />
            </label>
            <label style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, flex: 1, minWidth: 180 }}>
              Panel (optional)
              <input value={panel} placeholder="BluePrint, Comprehensive…"
                onChange={(e) => setPanel(e.target.value)}
                style={{ ...inp, marginTop: 4 }} />
            </label>
          </div>

          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
            Fill in only what the report has. The range columns are what it printed beside
            each value — leave them blank and a published range is used instead, which the
            chart will say.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 78px 78px 110px", gap: "6px 10px", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Marker</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Value</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Range low</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>high</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }} />

            {LAB_MARKERS.map((m) => {
              const p = preview(m.key);
              const t = p ? tone(p.verdict) : null;
              return (
                <div key={m.key} style={{ display: "contents" }}>
                  <div style={{ fontSize: 12.5 }}>
                    {m.label}
                    <span style={{ color: "var(--muted)" }}> · {m.unit}</span>
                  </div>
                  <input value={draft[m.key]?.value ?? ""} inputMode="decimal"
                    onChange={(e) => set(m.key, { value: e.target.value })} style={inp} />
                  <input value={draft[m.key]?.low ?? ""} inputMode="decimal" placeholder={String(m.fallback?.low ?? "")}
                    onChange={(e) => set(m.key, { low: e.target.value })} style={inp} />
                  <input value={draft[m.key]?.high ?? ""} inputMode="decimal" placeholder={String(m.fallback?.high ?? "")}
                    onChange={(e) => set(m.key, { high: e.target.value })} style={inp} />
                  {/* The verdict appears as she types. A decimal point in the
                      wrong place shows up now rather than on a chart in three
                      weeks' time. */}
                  <div style={{ fontSize: 11.5, fontWeight: 700, textAlign: "center",
                                borderRadius: 999, padding: "2px 8px",
                                background: t?.bg ?? "transparent", color: t?.fg ?? "transparent" }}>
                    {p ? p.verdict : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            <button type="button" style={darkBtn} disabled={!filled.length || busy} onClick={saveAll}>
              {busy ? "Saving…" : `Save ${filled.length || "no"} value${filled.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" style={ghost} onClick={() => { setAdding(false); setDraft({}); setErr(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---- WHAT IS ON FILE --------------------------------------------- */}
      {shown.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
          No values typed in yet. Until there are, a diet chart cannot read a deficiency —
          it can only be told about one.
        </div>
      ) : (
        <div style={{ ...box, overflow: "hidden" }}>
          {shown.map((r) => {
            const v = readValue(r);
            const t = tone(v.verdict);
            const m = markerFor(r.marker);
            return (
              <div key={r.id} style={{ borderTop: "1px solid var(--border)", padding: "9px 12px",
                                       display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 150, flex: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m?.label ?? r.label ?? r.marker}</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {" "}· {r.taken_on}{r.panel ? ` · ${r.panel}` : ""}
                    {r.entered_by ? ` · typed by ${r.entered_by}` : ""}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.value} {r.unit}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {v.low != null && v.high != null ? `${v.low}–${v.high}` : v.low != null ? `above ${v.low}` : v.high != null ? `below ${v.high}` : "no range"}
                  {!v.usingReport && v.verdict !== "unknown" && " (published)"}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 999,
                               padding: "2px 9px", background: t.bg, color: t.fg }}>
                  {v.verdict}
                </span>
                {canEdit && (
                  <button type="button" style={{ ...ghost, color: "var(--red-text)" }}
                    disabled={busy} onClick={() => remove(r.id)}
                    title="Only for a typing mistake — this does not retract a result">Remove</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
