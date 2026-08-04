"use client";

import { useState } from "react";
import { saveAppSettings, uploadDocTemplate } from "@/lib/actions";
import type { AppSettings, DocSheet } from "@/lib/settings";

const FONTS = [
  { label: "System default", value: "" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Poppins", value: "Poppins, system-ui, sans-serif" },
  { label: "Nunito Sans", value: "'Nunito Sans', system-ui, sans-serif" },
  { label: "Roboto", value: "Roboto, system-ui, sans-serif" },
  { label: "Lato", value: "Lato, system-ui, sans-serif" },
  { label: "Merriweather (serif)", value: "Merriweather, Georgia, serif" },
];

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px" };
const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%", boxSizing: "border-box" };
const label: React.CSSProperties = { fontSize: 12, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 4 };
const h: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: "0 0 12px" };

export default function TemplatesEditor({ initial, canEdit }: { initial: AppSettings; canEdit: boolean }) {
  const [s, setS] = useState<AppSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ro = !canEdit;

  // typed section setters
  const set = <K extends keyof AppSettings>(k: K, patch: Partial<AppSettings[K]>) => setS((p) => ({ ...p, [k]: { ...p[k], ...patch } }));

  const onLogo = (file: File | null) => {
    if (!file) return;
    if (file.size > 400_000) { setErr("Logo too large — use an image under 400 KB (PNG/SVG)."); return; }
    const r = new FileReader();
    r.onload = () => set("brand", { logo: String(r.result || "") });
    r.readAsDataURL(file);
  };

  // Sheet designs go to storage, not into the settings JSON — see
  // uploadDocTemplate for why. Uploading immediately persists the URL so the
  // artwork can't be lost by navigating away before pressing Save.
  const [upBusy, setUpBusy] = useState<string | null>(null);
  const onSheet = async (kind: "rx" | "lab", file: File | null) => {
    if (!file) return;
    setErr(null); setMsg(null); setUpBusy(kind);
    const fd = new FormData();
    fd.set("kind", kind); fd.set("file", file);
    const r = await uploadDocTemplate(fd);
    setUpBusy(null);
    if (r.error) { setErr(r.error); return; }
    const next = { ...s, docs: { ...s.docs, [kind]: { ...s.docs[kind], bg: r.url ?? "" } } };
    setS(next);
    const w = await saveAppSettings(JSON.stringify(next));
    setMsg(w.error ? null : "Design uploaded and saved.");
    if (w.error) setErr(w.error);
  };

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    const r = await saveAppSettings(JSON.stringify(s));
    setBusy(false);
    if (r.error) setErr(r.error); else setMsg("Saved. Changes apply across the app.");
  };

  return (
    <div style={{ maxWidth: 900, display: "grid", gap: 16 }}>
      {ro && <div style={{ ...card, padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>View only — ask an Administrator to change templates.</div>}

      {/* Branding */}
      <div style={card}>
        <div style={h}>Logo &amp; brand</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
            <div style={{ width: 76, height: 76, borderRadius: 14, background: "#fff", border: "1px solid var(--border)", display: "grid", placeItems: "center", overflow: "hidden" }}>
              <img src={s.brand.logo || "/cureocity-mark.png?v=2"} alt="logo" style={{ maxWidth: 60, maxHeight: 60, display: "block" }} />
            </div>
            {!ro && <label style={{ fontSize: 12, color: "var(--brand-text)", cursor: "pointer", fontWeight: 600 }}>Replace logo<input type="file" accept="image/png,image/svg+xml,image/jpeg" style={{ display: "none" }} onChange={(e) => onLogo(e.target.files?.[0] ?? null)} /></label>}
            {!ro && s.brand.logo && <button type="button" onClick={() => set("brand", { logo: "" })} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 11.5, cursor: "pointer" }}>Reset to default</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <span style={label}>Brand colour</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" disabled={ro} value={s.brand.color} onChange={(e) => set("brand", { color: e.target.value })} style={{ width: 42, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }} />
                <input disabled={ro} value={s.brand.color} onChange={(e) => set("brand", { color: e.target.value })} style={inp} />
              </div>
            </div>
            <div>
              <span style={label}>Font</span>
              <select disabled={ro} value={s.brand.font} onChange={(e) => set("brand", { font: e.target.value })} style={inp}>
                {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Letterhead */}
      <div style={card}>
        <div style={h}>Letterhead &amp; contact</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Shown on consultation letters, diet charts, prescriptions and payslips.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><span style={label}>Company name</span><input disabled={ro} value={s.letterhead.name} onChange={(e) => set("letterhead", { name: e.target.value })} style={inp} /></div>
          <div><span style={label}>Website</span><input disabled={ro} value={s.letterhead.website} onChange={(e) => set("letterhead", { website: e.target.value })} style={inp} /></div>
          <div><span style={label}>Address line 1</span><input disabled={ro} value={s.letterhead.addr1} onChange={(e) => set("letterhead", { addr1: e.target.value })} style={inp} /></div>
          <div><span style={label}>Address line 2</span><input disabled={ro} value={s.letterhead.addr2} onChange={(e) => set("letterhead", { addr2: e.target.value })} style={inp} /></div>
          <div><span style={label}>Phone</span><input disabled={ro} value={s.letterhead.phone} onChange={(e) => set("letterhead", { phone: e.target.value })} style={inp} /></div>
          <div><span style={label}>Email</span><input disabled={ro} value={s.letterhead.email} onChange={(e) => set("letterhead", { email: e.target.value })} style={inp} /></div>
        </div>
      </div>

      {/* Consultation letters */}
      <div style={card}>
        <div style={h}>Consultation letters</div>
        <div style={{ display: "grid", gap: 12 }}>
          <div><span style={label}>Sign-off company line</span><input disabled={ro} value={s.consult.signoffCompany} onChange={(e) => set("consult", { signoffCompany: e.target.value })} style={inp} /></div>
          <div><span style={label}>Initial consultation — closing paragraph (optional, added before the sign-off)</span><textarea disabled={ro} rows={3} value={s.consult.initialClosing} onChange={(e) => set("consult", { initialClosing: e.target.value })} style={{ ...inp, resize: "vertical" }} /></div>
          <div><span style={label}>Follow-up consultation — closing paragraph (optional)</span><textarea disabled={ro} rows={3} value={s.consult.followupClosing} onChange={(e) => set("consult", { followupClosing: e.target.value })} style={{ ...inp, resize: "vertical" }} /></div>
        </div>
      </div>

      {/* Diet chart + prescription */}
      <div style={card}>
        <div style={h}>Diet chart &amp; prescription</div>
        <div style={{ display: "grid", gap: 12 }}>
          <div><span style={label}>Diet chart — default meal rows (comma separated)</span><input disabled={ro} value={s.diet.defaultRows.join(", ")} onChange={(e) => set("diet", { defaultRows: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} style={inp} /></div>
          <div><span style={label}>Diet chart — footer note (printed on the PDF)</span><textarea disabled={ro} rows={2} value={s.diet.footerNote} onChange={(e) => set("diet", { footerNote: e.target.value })} style={{ ...inp, resize: "vertical" }} /></div>
          <div><span style={label}>Prescription — header line</span><input disabled={ro} value={s.rx.header} onChange={(e) => set("rx", { header: e.target.value })} style={inp} /></div>
          <div><span style={label}>Prescription — footer line</span><input disabled={ro} value={s.rx.footer} onChange={(e) => set("rx", { footer: e.target.value })} style={inp} /></div>
        </div>
      </div>


      {/* Printable sheet designs */}
      <div style={card}>
        <div style={h}>Prescription &amp; lab sheet designs</div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
          Upload the full A4 sheet as you designed it — letterhead, watermark, footer and all.
          It becomes the page background; the patient details, medicines and tests are printed
          into the clear area you set below. Export at <b>A4 portrait, 150–300 DPI</b>
          (about 1240 × 1754 px at 150 DPI). Leave a design out and the sheet falls back to
          a plain letterhead built from the details above.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {([["rx", "Prescription"], ["lab", "Lab requisition"]] as const).map(([k, title]) => {
            const d: DocSheet = s.docs[k];
            return (
              <div key={k} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{title}</div>
                {/* Preview at A4 proportions so the safe area is believable. */}
                <div style={{ position: "relative", width: "100%", aspectRatio: "210 / 297", background: "#fff", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
                  {d.bg
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={d.bg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 11.5, color: "var(--muted)", textAlign: "center", padding: 10 }}>No design uploaded<br />— plain letterhead is used</div>}
                  <div style={{ position: "absolute", left: `${(d.side / 210) * 100}%`, right: `${(d.side / 210) * 100}%`, top: `${(d.top / 297) * 100}%`, bottom: `${(d.bottom / 297) * 100}%`, border: "1.5px dashed rgba(225,31,52,.75)", borderRadius: 3, pointerEvents: "none" }} />
                </div>
                {!ro && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 12, color: "var(--brand-text)", cursor: "pointer", fontWeight: 600 }}>
                      {upBusy === k ? "Uploading…" : d.bg ? "Replace design" : "Upload design"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => onSheet(k, e.target.files?.[0] ?? null)} />
                    </label>
                    {d.bg && <button type="button" onClick={() => set("docs", { [k]: { ...d, bg: "" } } as Partial<AppSettings["docs"]>)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 11.5, cursor: "pointer" }}>Remove</button>}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {(["top", "bottom", "side"] as const).map((m) => (
                    <div key={m}>
                      <span style={{ ...label, marginBottom: 2 }}>{m === "side" ? "Sides" : m === "top" ? "Top" : "Bottom"} (mm)</span>
                      <input disabled={ro} type="number" min={0} max={120} value={d[m]}
                        onChange={(e) => set("docs", { [k]: { ...d, [m]: Math.max(0, Math.min(120, Number(e.target.value) || 0)) } } as Partial<AppSettings["docs"]>)}
                        style={{ ...inp, padding: "6px 8px" }} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
          The dashed box shows where content will print. Widen the top margin if your letterhead is deep.
        </div>
      </div>

      {!ro && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" onClick={save} disabled={busy} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save changes"}</button>
          {msg && <span style={{ color: "var(--green-text)", fontSize: 13 }}>{msg}</span>}
          {err && <span style={{ color: "var(--red-text)", fontSize: 13 }}>{err}</span>}
        </div>
      )}
    </div>
  );
}
