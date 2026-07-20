"use client";

import { useState } from "react";
import { savePackage, togglePackageActive } from "@/lib/actions";
import Chip from "@/components/Chip";

export type CatSvc = { name: string; category: string; slot: boolean };
export type CatPkg = {
  id: string; name: string; line: string; lineLabel: string; weeks: number | null;
  sessions: number; validity: number; is_facility: boolean; active: boolean;
  one_time: boolean; requires_slot: boolean; delivery_mode: string; tags: string[];
  prices: Record<string, number>; mrp: number | null; clientCount: number; services: CatSvc[];
};

const GST = 0.18;
function money(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
function money2(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function PackageCatalog({
  packages, branches, canManage,
}: { packages: CatPkg[]; branches: string[]; canManage: boolean }) {
  const [branch, setBranch] = useState(branches[0] ?? "Kochi");
  const [dur, setDur] = useState<Record<string, string>>({});
  const [editId, setEditId] = useState<string | null>(null); // package id, "" = new, null = closed

  // group into lines
  const lines = new Map<string, CatPkg[]>();
  for (const p of packages) { (lines.get(p.line) ?? lines.set(p.line, []).get(p.line)!).push(p); }
  for (const arr of lines.values()) arr.sort((a, b) => (a.weeks ?? 0) - (b.weeks ?? 0));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const chip = (bg: string, c: string, t: string) => <Chip bg={bg} color={c} style={{ padding: "3px 9px" }}>{t}</Chip>;
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%" };

  const card = (variants: CatPkg[]) => {
    const line = variants[0].line;
    const pick = dur[line];
    const sel = variants.find((v) => String(v.weeks) === pick) ?? variants.find((v) => v.weeks === 12) ?? variants[0];
    const price = sel.prices[branch] ?? 0;
    const base = price / (1 + GST), gst = price - base;
    const clients = variants.reduce((s, v) => s + v.clientCount, 0);
    const byCat = new Map<string, CatSvc[]>();
    for (const s of sel.services) { (byCat.get(s.category) ?? byCat.set(s.category, []).get(s.category)!).push(s); }

    return (
      <div key={line} style={{ ...box, padding: 0, opacity: sel.active ? 1 : 0.55, overflow: "hidden" }}>
        <div style={{ height: 5, background: "var(--brand-fill)" }} />
        <div style={{ padding: "16px 18px" }}>
          <b style={{ fontSize: 15.5 }}>{sel.lineLabel}</b>

          {/* duration toggles */}
          {variants.length > 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "10px 0" }}>
              {variants.map((v) => (
                <button key={v.id} type="button" onClick={() => setDur((d) => ({ ...d, [line]: String(v.weeks) }))} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "7px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", background: v.id === sel.id ? "var(--brand-fill)" : "#fff", color: v.id === sel.id ? "#fff" : "var(--muted)" }}>{v.weeks} Weeks</button>
              ))}
            </div>
          )}

          {/* attribute chips */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" }}>
            {sel.one_time && chip("var(--purple-bg)", "var(--purple-text)", "🔵 One-time purchase")}
            {sel.requires_slot ? chip("var(--amber-bg)", "var(--amber-text)", "📅 Requires slot booking") : chip("var(--neutral-bg)", "var(--muted)", "No slot needed")}
            {chip("var(--blue-bg)", "var(--blue-text)", sel.delivery_mode)}
            {sel.tags.map((t) => chip("var(--green-bg)", "var(--green-text)", t))}
            {!sel.active && chip("var(--red-bg)", "var(--red-text)", "Deactivated")}
          </div>

          {/* price + gst */}
          <div style={{ fontSize: 30, fontWeight: 800 }}>
            {sel.mrp && sel.mrp > price ? <span style={{ textDecoration: "line-through", color: "var(--muted)", fontSize: 16, fontWeight: 600, marginRight: 8 }}>{money(sel.mrp)}</span> : null}
            {money(price)}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>incl. GST — {money(base)} + {money2(gst)} GST</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>{sel.sessions} session credit{sel.sessions === 1 ? "" : "s"} · valid {sel.validity} days</div>

          {/* services by category */}
          {[...byCat.entries()].map(([cat, list]) => (
            <div key={cat} style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--muted)" }}>{cat}</div>
              <ul style={{ margin: "3px 0 0", paddingLeft: 4, listStyle: "none" }}>
                {list.map((s) => <li key={s.name} style={{ fontSize: 13, padding: "2px 0" }}><span style={{ color: "var(--green)" }}>✓</span> {s.name}{s.slot ? " 📅" : ""}</li>)}
              </ul>
            </div>
          ))}

          {/* footer */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
            {chip("var(--neutral-bg)", "var(--muted)", `${clients} client${clients === 1 ? "" : "s"}`)}
            <span style={{ flex: 1 }} />
            {canManage && <button type="button" onClick={() => setEditId(sel.id)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>}
            {canManage && <form action={togglePackageActive}><input type="hidden" name="id" value={sel.id} /><input type="hidden" name="active" value={String(sel.active)} /><button style={{ border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: sel.active ? "var(--red-bg)" : "var(--brand-fill)", color: sel.active ? "var(--red-text)" : "#fff" }}>{sel.active ? "Deactivate" : "Reactivate"}</button></form>}
          </div>
        </div>
      </div>
    );
  };

  const editing = editId != null ? packages.find((p) => p.id === editId) ?? null : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Front desk location:</span>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} style={{ ...inp, width: "auto" }}>{branches.map((b) => <option key={b}>{b}</option>)}</select>
        <span style={{ flex: 1 }} />
        {chip("var(--neutral-bg)", "var(--muted)", "Pick a duration inside each card")}
        {canManage && <button type="button" onClick={() => setEditId("")} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New Package</button>}
      </div>

      {editId != null && (
        <form action={savePackage} onSubmit={() => setTimeout(() => setEditId(null), 50)} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>{editing ? "Edit package" : "New package"}</div>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <input name="name" placeholder="Package name" required defaultValue={editing?.name ?? ""} style={inp} />
            <input name="sessions" type="number" placeholder="Session credits" defaultValue={editing?.sessions ?? 0} style={inp} />
            <input name="validity" type="number" placeholder="Validity (days)" defaultValue={editing?.validity ?? 0} style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Price — Kochi<input name="price_kochi" type="number" defaultValue={editing?.prices["Kochi"] ?? 0} style={inp} /></label>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Price — Calicut<input name="price_calicut" type="number" defaultValue={editing?.prices["Calicut"] ?? 0} style={inp} /></label>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Delivery<select name="delivery_mode" defaultValue={editing?.delivery_mode ?? "Offline"} style={inp}><option>Offline</option><option>Hybrid</option><option>Online</option></select></label>
          </div>
          <input name="tags" placeholder="Tags (comma separated) — e.g. personal, continuous" defaultValue={(editing?.tags ?? []).join(", ")} style={inp} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="is_facility" defaultChecked={editing?.is_facility} /> Facility membership</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="requires_slot" defaultChecked={editing?.requires_slot} /> Requires slot booking</label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="one_time" defaultChecked={editing?.one_time} /> One-time purchase</label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</button>
            <button type="button" onClick={() => setEditId(null)} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        {[...lines.values()].map((variants) => card(variants))}
      </div>
    </div>
  );
}
