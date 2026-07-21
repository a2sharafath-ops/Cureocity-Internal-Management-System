"use client";

import { useState } from "react";
import { createLead, updateLead, initiateCall } from "@/lib/actions";

const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, background: "#fff", width: "100%" };
// Same look, but a fixed height — an <input> and a <select> do not share
// an intrinsic height, so identical padding leaves them visibly staggered.
// Not applied to <textarea>, which must stay free to grow.
const inputControl: React.CSSProperties = { ...input, padding: "0 10px", height: 36, boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--muted)" };
const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };

export type Lead = {
  id: string; name: string; phone: string | null; email: string | null; source: string | null; campaign: string | null; interest: string | null;
  urgency: string | null; history: string | null; goals: string | null; location: string | null;
  budget: string | null; profession: string | null; fde: string | null; stage: string | null;
  owner_id?: string | null;
  objection: string | null; notes: string | null;
};

const SOURCES = ["Walk-in", "Instagram", "Facebook", "Google / Search", "WhatsApp", "Referral", "Website", "Event / Camp", "Phone enquiry", "Other"];
const INTERESTS = ["Personal Training", "Diet/Nutrition", "Full Package (Medical+Diet+PT)", "Gym/Fitness", "Assessment/Testing", "Just Exploring", "Not Sure"];
const URGENCY = ["Medical advice to exercise", "Strong - wants to start now", "Event/deadline (wedding etc.)", "Just moved/relocated", "New Year resolution", "Just exploring options", "No clear urgency"];
const GOALS = ["Specific weight loss target", "Manage health condition (diabetes/BP etc)", "Build muscle/body composition", "Rehab/pain management", "General fitness/energy", "Look better", "No specific goal"];
const HISTORY = ["Had PT before", "Regular gym-goer (1+ year)", "Used to go but stopped", "Online/home workouts only", "Tried a few times", "Complete beginner"];
const BUDGET = ["Doesnt ask price first - quality focused", "Mentions premium gyms", "Asks price immediately", "Compares to budget gyms", "Says too expensive"];
const STAGES = ["1-New Lead", "2-Discovery", "3-Product Match", "4-Visit/Trial", "5-Close", "6-Nurture", "LOST"];
const OBJECTIONS = ["Price too high", "Timing not right now", "Location / distance", "Needs to consult family", "Comparing other gyms", "Not sure of commitment", "Medical clearance pending"];

function Sel({ name, label, opts, def }: { name: string; label: string; opts: string[]; def?: string | null }) {
  return <div style={{ display: "grid", gap: 3 }}><label style={lbl}>{label}</label><select style={inputControl} name={name} defaultValue={def ?? ""}><option value="">—</option>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>;
}

export type StaffOpt = { id: string; name: string };

export function LeadFields({ lead, campaigns, staff }: { lead?: Lead; campaigns: string[]; staff: StaffOpt[] }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Name *</label><input style={inputControl} name="name" required defaultValue={lead?.name ?? ""} /></div>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Phone</label><input style={inputControl} name="phone" defaultValue={lead?.phone ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <label style={lbl}>Email <span style={{ opacity: .6 }}>(optional)</span></label>
          {/* Optional on purpose — this is a phone-first business. When given,
              it triggers an acknowledgement email on save. */}
          <input style={inputControl} type="email" name="email" defaultValue={lead?.email ?? ""} placeholder="name@example.com" />
        </div>
        <Sel name="source" label="Source" opts={SOURCES} def={lead?.source} />
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Campaign</label><input style={inputControl} name="campaign" list="lead-campaigns" defaultValue={lead?.campaign ?? ""} placeholder="e.g. Summer Shred '26" /><datalist id="lead-campaigns">{campaigns.map((c) => <option key={c} value={c} />)}</datalist></div>
        <div style={{ display: "grid", gap: 3 }}>
          <label style={lbl}>Owner</label>
          <select style={inputControl} name="owner_id" defaultValue={lead?.owner_id ?? ""}>
            {/* Blank means "use whoever is creating this", handled server-side.
                It is never left permanently unowned. */}
            <option value="">— me —</option>
            {staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Sel name="interest" label="Interest" opts={INTERESTS} def={lead?.interest} />
        <Sel name="urgency" label="Urgency" opts={URGENCY} def={lead?.urgency} />
        <Sel name="goals" label="Goal" opts={GOALS} def={lead?.goals} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Sel name="history" label="Fitness history" opts={HISTORY} def={lead?.history} />
        <Sel name="budget" label="Budget signal" opts={BUDGET} def={lead?.budget} />
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Location</label><input style={inputControl} name="location" defaultValue={lead?.location ?? ""} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Profession</label><input style={inputControl} name="profession" defaultValue={lead?.profession ?? ""} /></div>
        <Sel name="stage" label="Pipeline stage" opts={STAGES} def={lead?.stage ?? "1-New Lead"} />
        <Sel name="objection" label="Objection (if raised)" opts={OBJECTIONS} def={lead?.objection} />
      </div>
      <div style={{ display: "grid", gap: 3 }}><label style={lbl}>Notes</label><textarea style={{ ...input, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} name="notes" defaultValue={lead?.notes ?? ""} placeholder="Enquiry context, preferences, follow-up notes…" /></div>
    </>
  );
}

export function LeadForm({ campaigns, staff }: { campaigns: string[]; staff: StaffOpt[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add lead</button>;
  return (
    <form action={createLead} onSubmit={() => setTimeout(() => setOpen(false), 50)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: 16, marginBottom: 16, display: "grid", gap: 10, textAlign: "left" }}>
      <LeadFields campaigns={campaigns} staff={staff} />
      <div><button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add lead</button></div>
    </form>
  );
}

export function LeadEditForm({ lead, campaigns, staff }: { lead: Lead; campaigns: string[]; staff: StaffOpt[] }) {
  return (
    <form action={updateLead} style={{ display: "grid", gap: 10 }}>
      <input type="hidden" name="id" value={lead.id} />
      <LeadFields lead={lead} campaigns={campaigns} staff={staff} />
      <div><button type="submit" style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save changes</button></div>
    </form>
  );
}

export function CallCell({ phone, ivrConfigured }: { phone: string | null; ivrConfigured: boolean }) {
  const tel = (phone ?? "").replace(/[^\d+]/g, "");
  if (!tel) return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;
  return ivrConfigured ? (
    <form action={initiateCall}><input type="hidden" name="phone" value={tel} /><button type="submit" title="Click-to-call via IVR" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)" }}>📞 Call</button></form>
  ) : (
    <a href={`tel:${tel}`} title="Open dialer" style={{ ...btn, borderColor: "var(--brand-fill)", color: "var(--brand-text)", textDecoration: "none", display: "inline-block" }}>📞 Call</a>
  );
}
