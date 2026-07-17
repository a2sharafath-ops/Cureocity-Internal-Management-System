"use client";

import { useMemo, useState, useTransition } from "react";
import { createPrescription } from "@/lib/actions";
import { screenAll } from "@/lib/rxdata";

type Line = { drug: string; dose: string; frequency: string; route: string; duration: string; quantity: string; instructions: string };
const blank = (): Line => ({ drug: "", dose: "", frequency: "", route: "oral", duration: "", quantity: "", instructions: "" });

const input: React.CSSProperties = { padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };

export default function RxForm({ clientId, allergies, currentMeds }: { clientId: string; allergies: string[]; currentMeds: string[] }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const drugNames = lines.map((l) => l.drug).filter(Boolean);
  // screen new drugs against each other, current meds, and allergies
  const flags = useMemo(
    () => screenAll([...drugNames, ...currentMeds], allergies).filter((f) =>
      // only surface flags that involve at least one NEW drug
      drugNames.some((d) => f.text.toLowerCase().includes(d.toLowerCase()))
    ),
    [drugNames.join("|"), currentMeds.join("|"), allergies.join("|")]
  );
  const severe = flags.some((f) => f.severity === "severe");

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const addLine = () => setLines((ls) => [...ls, blank()]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const submit = (status: "signed" | "draft") => {
    setMsg(null);
    const items = lines.filter((l) => l.drug.trim());
    if (items.length === 0) { setMsg("Add at least one drug."); return; }
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("status", status);
    fd.set("items", JSON.stringify(items));
    fd.set("notes", notes);
    if (flags.length) fd.set("flags", flags.map((f) => `[${f.severity}] ${f.text}`).join(" | "));
    start(async () => {
      const res = await createPrescription(fd);
      if (res?.ok) { setLines([blank()]); setNotes(""); setOpen(false); }
      else setMsg(res?.error ?? "Failed");
    });
  };

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ New prescription</button>;
  }

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 8 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
          <div><label style={lbl}>Drug</label><input style={input} value={l.drug} onChange={(e) => setLine(i, { drug: e.target.value })} placeholder="e.g. Amoxicillin" /></div>
          <div><label style={lbl}>Dose</label><input style={input} value={l.dose} onChange={(e) => setLine(i, { dose: e.target.value })} placeholder="500 mg" /></div>
          <div><label style={lbl}>Frequency</label><input style={input} value={l.frequency} onChange={(e) => setLine(i, { frequency: e.target.value })} placeholder="TDS" /></div>
          <div><label style={lbl}>Route</label>
            <select style={input} value={l.route} onChange={(e) => setLine(i, { route: e.target.value })}><option>oral</option><option>topical</option><option>IV</option><option>IM</option><option>SC</option><option>inhaled</option></select>
          </div>
          <div><label style={lbl}>Duration</label><input style={input} value={l.duration} onChange={(e) => setLine(i, { duration: e.target.value })} placeholder="5 days" /></div>
          <div><label style={lbl}>Qty</label><input style={input} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="15" /></div>
          <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 13, cursor: lines.length === 1 ? "not-allowed" : "pointer", color: "var(--muted)" }}>✕</button>
        </div>
      ))}
      <button type="button" onClick={addLine} style={{ background: "#fff", color: "var(--teal-dark)", border: "1px solid var(--teal)", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>+ Add drug</button>

      {flags.length > 0 && (
        <div style={{ background: severe ? "#fee2e2" : "var(--amber-bg)", border: `1px solid ${severe ? "#fecaca" : "#fde68a"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: severe ? "var(--red)" : "#92400e", marginBottom: 4 }}>⚠ {flags.length} interaction/allergy flag{flags.length === 1 ? "" : "s"}</div>
          {flags.map((f, i) => (
            <div key={i} style={{ fontSize: 12.5, color: f.severity === "severe" ? "var(--red)" : "#92400e" }}>• {f.text}</div>
          ))}
        </div>
      )}

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to pharmacist / patient (optional)" style={{ ...input, minHeight: 44, marginBottom: 10, resize: "vertical" }} />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={() => submit("signed")} disabled={pending} style={{ background: severe ? "var(--red)" : "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: pending ? "not-allowed" : "pointer" }}>
          {pending ? "Saving…" : severe ? "Sign despite warnings" : "Prescribe & sign"}
        </button>
        <button type="button" onClick={() => submit("draft")} disabled={pending} style={{ background: "#fff", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>Save draft</button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: "transparent", color: "var(--muted)", border: "none", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        {msg && <span style={{ color: "var(--red)", fontSize: 13 }}>{msg}</span>}
      </div>
    </div>
  );
}
