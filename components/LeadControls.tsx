"use client";

import { useState } from "react";
import { createLead, updateLead, initiateCall } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };

export type Lead = {
  id: string; name: string; phone: string | null; source: string | null; campaign: string | null; interest: string | null;
  urgency: string | null; history: string | null; goals: string | null; location: string | null;
  budget: string | null; profession: string | null; fde: string | null; stage: string | null;
};

const SOURCES = ["Walk-in", "Instagram", "Facebook", "Google / Search", "WhatsApp", "Referral", "Website", "Event / Camp", "Phone enquiry", "Other"];
const INTERESTS = ["Personal Training", "Diet/Nutrition", "Full Package (Medical+Diet+PT)", "Gym/Fitness", "Assessment/Testing", "Just Exploring", "Not Sure"];
const URGENCY = ["Medical advice to exercise", "Strong - wants to start now", "Event/deadline (wedding etc.)", "Just moved/relocated", "New Year resolution", "Just exploring options", "No clear urgency"];
const GOALS = ["Specific weight loss target", "Manage health condition (diabetes/BP etc)", "Build muscle/body composition", "Rehab/pain management", "General fitness/energy", "Look better", "No specific goal"];
const HISTORY = ["Had PT before", "Regular gym-goer (1+ year)", "Used to go but stopped", "Online/home workouts only", "Tried a few times", "Complete beginner"];
const BUDGET = ["Doesnt ask price first - quality focused", "Mentions premium gyms", "Asks price immediately", "Compares to budget gyms", "Says too expensive"];

function Sel({ name, label, opts, def }: { name: string; label: string; opts: string[]; def?: string | null }) {
  return <div style={{ display: "grid", gap: 3 }}><label style={lbl}>{label}</label><select style={input} name={name} defaultValue={def ?? ""}><option value="">—</option>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>;
}

export function LeadFields({ lead, campaigns }: { lead?: Lead; campaigns: string[] }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Name *</label><input style={input} name="name" required defaultValue={lead?.name ?? ""} /></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Phone</label><input style={input} name="phone" defaultValue={lead?.phone ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Sel name="source" label="Source" opts={SOURCES} def={lead?.source} />
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Campaign</label><input style={input} name="campaign" list="lead-campaigns" defaultValue={lead?.campaign ?? ""} placeholder="e.g. Summer Shred '26" /><datalist id="lead-campaigns">{campaigns.map((c) => <option key={c} value={c} />)}</datalist></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Front desk (FDE)</label><input style={input} name="fde" defaultValue={lead?.fde ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Sel name="interest" label="Interest" opts={INTERESTS} def={lead?.interest} />
        <Sel name="urgency" label="Urgency" opts={URGENCY} def={lead?.urgency} />
        <Sel name="goals" label="Goal" opts={GOALS} def={lead?.goals} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Sel name="history" label="Fitness history" opts={HISTORY} def={lead?.history} />
        <Sel name="budget" label="Budget signal" opts={BUDGET} def={lead?.budget} />
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Location</label><input style={input} name="location" defaultValue={lead?.location ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Profession</label><input style={input} name="profession" defaultValue={lead?.profession ?? ""} /></div>
    </>
  );
}

export function LeadForm({ campaigns }: { campaigns: string[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add lead</button>;
  return (
    <form action={createLead} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10, textAlign: "left" }}>
      <LeadFields campaigns={campaigns} />
      <div><button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add lead</button></div>
    </form>
  );
}

export function LeadEditForm({ lead, campaigns }: { lead: Lead; campaigns: string[] }) {
  return (
    <form action={updateLead} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="id" value={lead.id} />
      <LeadFields lead={lead} campaigns={campaigns} />
      <div><button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save changes</button></div>
    </form>
  );
}

export function CallCell({ phone, ivrConfigured }: { phone: string | null; ivrConfigured: boolean }) {
  const tel = (phone ?? "").replace(/[^\d+]/g, "");
  if (!tel) return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;
  return ivrConfigured ? (
    <form action={initiateCall}><input type="hidden" name="phone" value={tel} /><button type="submit" title="Click-to-call via IVR" style={{ ...btn, borderColor: "var(--teal)", color: "var(--teal-dark)" }}>📞 Call</button></form>
  ) : (
    <a href={`tel:${tel}`} title="Open dialer" style={{ ...btn, borderColor: "var(--teal)", color: "var(--teal-dark)", textDecoration: "none", display: "inline-block" }}>📞 Call</a>
  );
}
