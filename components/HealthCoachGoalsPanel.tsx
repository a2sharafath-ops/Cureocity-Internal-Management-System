"use client";

import { useState } from "react";
import {
  addCoachingBarrier, createHabit, recordCoachingAdherence,
  resolveCoachingBarrier, reviewCoachingGoal, setCoachingGoalStatus,
} from "@/lib/actions";
import {
  ADHERENCE_CATEGORIES, BARRIER_CATEGORIES, adherenceSummary,
  confidenceNeedsSmallerGoal, reviewIsDue, type AdherenceOutcome,
} from "@/lib/coach-goals";
import { last7Count } from "@/lib/habits";

export type CoachingGoalView = {
  id: string; name: string; icon: string | null; cadence: string; target_per_week: number;
  cue: string | null; time_place: string | null; importance: number | null;
  confidence: number | null; barrier_code: string | null; barrier_detail: string | null;
  if_then_plan: string | null; review_date: string | null; status: string; active: boolean;
  doneDates: string[];
};

export type CoachingAdherenceView = {
  id: string; goal_id: string | null; category: string; event_date: string;
  outcome: AdherenceOutcome; source: string; note: string | null; recorder_name: string;
};

export type CoachingBarrierView = {
  id: string; goal_id: string | null; category: string; detail: string;
  coach_response: string | null; status: string; identified_at: string;
  resolved_by: string | null; resolved_at: string | null; resolution_note: string | null;
};

const field: React.CSSProperties = { width: "100%", height: 36, boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", background: "#fff", fontSize: 12.5 };
const area: React.CSSProperties = { ...field, height: 66, padding: "8px 10px", resize: "vertical" };
const label: React.CSSProperties = { display: "grid", gap: 4, color: "var(--muted)", fontSize: 11 };
const button: React.CSSProperties = { border: 0, borderRadius: 8, padding: "8px 12px", background: "var(--ink)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" };
const quietButton: React.CSSProperties = { ...button, border: "1px solid var(--border)", background: "#fff", color: "var(--ink)" };

export default function HealthCoachGoalsPanel({ clientId, goals, events, barriers, canManage, today }: {
  clientId: string; goals: CoachingGoalView[]; events: CoachingAdherenceView[];
  barriers: CoachingBarrierView[]; canManage: boolean; today: string;
}) {
  const [confidence, setConfidence] = useState(7);
  const active = goals.filter((goal) => goal.status === "Active");
  const openBarriers = barriers.filter((barrier) => barrier.status !== "Resolved");
  const recentEvents = events.slice(0, 20);

  return (
    <section id="coaching-goals" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 250 }}>
          <div style={{ fontWeight: 750 }}>Goals &amp; adherence</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>Behaviour goals, reviewed outcomes and the barriers affecting follow-through.</div>
        </div>
        <span style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 999, background: "var(--neutral-bg)", color: "var(--muted)" }}>{active.length} active · {openBarriers.length} open barrier{openBarriers.length === 1 ? "" : "s"}</span>
      </div>

      {canManage && (
        <details style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>+ Create a behaviour goal</summary>
          <form action={createHabit} style={{ marginTop: 12 }}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="icon" value="◎" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <label style={{ ...label, gridColumn: "span 2" }}>Target behaviour<input name="name" required style={field} placeholder="Walk for 15 minutes after lunch" /></label>
              <label style={label}>Frequency<select name="cadence" style={field} defaultValue="weekly"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
              <label style={label}>Target per week<input name="target_per_week" type="number" min={1} max={7} defaultValue={3} required style={field} /></label>
              <label style={label}>Cue<input name="cue" style={field} placeholder="After lunch" /></label>
              <label style={label}>Time / place<input name="time_place" style={field} placeholder="1:30 pm, near office" /></label>
              <label style={label}>Importance (0–10)<input name="importance" type="number" min={0} max={10} defaultValue={8} style={field} /></label>
              <label style={label}>Confidence (0–10)<input name="confidence" type="number" min={0} max={10} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} style={field} /></label>
              <label style={label}>Main barrier<select name="barrier_code" style={field} defaultValue=""><option value="">Not identified</option>{BARRIER_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label style={label}>First review date<input name="review_date" type="date" min={today} style={field} /></label>
              <label style={{ ...label, gridColumn: "span 2" }}>Barrier detail<textarea name="barrier_detail" style={area} placeholder="What is likely to get in the way?" /></label>
              <label style={{ ...label, gridColumn: "span 2" }}>If–then plan<textarea name="if_then_plan" style={area} placeholder="If the usual walk is disrupted, then I will…" /></label>
            </div>
            {confidenceNeedsSmallerGoal(confidence) && <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "var(--amber-bg)", color: "var(--amber-text)", fontSize: 12, fontWeight: 650 }}>Confidence is below 7. Make the behaviour smaller or easier with the client before saving it.</div>}
            <button type="submit" style={{ ...button, marginTop: 12 }}>Save goal</button>
          </form>
        </details>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {goals.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "10px 0" }}>No coaching goals recorded yet.</div>}
        {goals.map((goal) => {
          const week = last7Count(goal.doneDates, today);
          const due = goal.status === "Active" && reviewIsDue(goal.review_date, today);
          return (
            <div key={goal.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, opacity: goal.status === "Stopped" ? .65 : 1 }}>
              <div style={{ display: "flex", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 19 }}>{goal.icon || "◎"}</span>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><b style={{ fontSize: 14 }}>{goal.name}</b><span style={{ fontSize: 10.5, borderRadius: 999, padding: "2px 8px", background: due ? "var(--amber-bg)" : "var(--neutral-bg)", color: due ? "var(--amber-text)" : "var(--muted)", fontWeight: 700 }}>{due ? "Review due" : goal.status}</span></div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>{week}/{goal.target_per_week} completed in the last 7 days · confidence {goal.confidence ?? "—"}/10 · importance {goal.importance ?? "—"}/10</div>
                  {(goal.cue || goal.time_place) && <div style={{ fontSize: 12, marginTop: 5 }}><b>Cue:</b> {[goal.cue, goal.time_place].filter(Boolean).join(" · ")}</div>}
                  {goal.if_then_plan && <div style={{ fontSize: 12, marginTop: 3 }}><b>If–then:</b> {goal.if_then_plan}</div>}
                  {(goal.barrier_code || goal.barrier_detail) && <div style={{ fontSize: 12, marginTop: 3, color: "var(--amber-text)" }}><b>Barrier:</b> {[goal.barrier_code, goal.barrier_detail].filter(Boolean).join(" — ")}</div>}
                  <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 5 }}>Next review: {goal.review_date || "not scheduled"}</div>
                </div>
              </div>
              {canManage && goal.status === "Active" && <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
                {(["Completed", "Missed", "Excused"] as const).map((outcome) => <form action={recordCoachingAdherence} key={outcome}><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="goal_id" value={goal.id} /><input type="hidden" name="category" value="Coaching goal" /><input type="hidden" name="event_date" value={today} /><input type="hidden" name="outcome" value={outcome} /><button style={outcome === "Completed" ? button : quietButton}>{outcome} today</button></form>)}
                <details style={{ fontSize: 12 }}><summary style={{ ...quietButton, listStyle: "none" }}>Review goal</summary><form action={reviewCoachingGoal} style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}><input type="hidden" name="id" value={goal.id} /><input type="hidden" name="client_id" value={clientId} /><input name="review_date" type="date" min={today} required style={{ ...field, width: 150 }} /><input name="note" placeholder="Review note" style={{ ...field, width: 210 }} /><button style={button}>Save review</button></form></details>
                {(["Paused", "Completed"] as const).map((status) => <form action={setCoachingGoalStatus} key={status}><input type="hidden" name="id" value={goal.id} /><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="status" value={status} /><button style={quietButton}>{status === "Paused" ? "Pause" : "Close as completed"}</button></form>)}
              </div>}
              {canManage && goal.status === "Paused" && <form action={setCoachingGoalStatus} style={{ marginTop: 10 }}><input type="hidden" name="id" value={goal.id} /><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="status" value="Active" /><button style={button}>Reactivate</button></form>}
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Recorded adherence</div>
          <div style={{ color: "var(--muted)", fontSize: 11.5, margin: "2px 0 9px" }}>Percentages use completed ÷ (completed + missed). Excused events stay visible but are excluded.</div>
          <div style={{ display: "grid", gap: 5 }}>
            {ADHERENCE_CATEGORIES.map((category) => { const summary = adherenceSummary(events.filter((event) => event.category === category)); return <div key={category} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "5px 0", borderTop: "1px solid var(--border)" }}><span>{category}</span><b>{summary.percent == null ? "No reviewed events" : `${summary.percent}% · ${summary.completed}/${summary.reviewed}`}</b></div>; })}
          </div>
          {canManage && <details style={{ marginTop: 9 }}><summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12 }}>+ Record another adherence event</summary><form action={recordCoachingAdherence} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 8 }}><input type="hidden" name="client_id" value={clientId} /><select name="category" style={field}>{ADHERENCE_CATEGORIES.filter((x) => x !== "Coaching goal").map((x) => <option key={x}>{x}</option>)}</select><select name="outcome" style={field}><option>Completed</option><option>Missed</option><option>Excused</option></select><input name="event_date" type="date" max={today} defaultValue={today} style={field} /><input name="note" placeholder="Evidence or context" style={field} /><button style={{ ...button, gridColumn: "span 2" }}>Record event</button></form></details>}
          {recentEvents.length > 0 && <details style={{ marginTop: 9 }}><summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Recent event history ({recentEvents.length})</summary>{recentEvents.map((event) => <div key={event.id} style={{ fontSize: 11.5, borderTop: "1px solid var(--border)", padding: "5px 0" }}><b>{event.event_date} · {event.outcome}</b> — {event.category}{event.note ? ` · ${event.note}` : ""}</div>)}</details>}
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Barriers</div>
          <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
            {openBarriers.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12 }}>No open barriers recorded.</div>}
            {openBarriers.map((barrier) => <div key={barrier.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 9, fontSize: 12 }}><b>{barrier.category}</b><div>{barrier.detail}</div>{barrier.coach_response && <div style={{ color: "var(--muted)", marginTop: 3 }}>Response: {barrier.coach_response}</div>}{canManage && <form action={resolveCoachingBarrier} style={{ display: "flex", gap: 6, marginTop: 7 }}><input type="hidden" name="id" value={barrier.id} /><input type="hidden" name="client_id" value={clientId} /><input name="resolution_note" required placeholder="How was it resolved?" style={{ ...field, flex: 1 }} /><button style={quietButton}>Resolve</button></form>}</div>)}
          </div>
          {canManage && <details style={{ marginTop: 9 }}><summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12 }}>+ Record a barrier</summary><form action={addCoachingBarrier} style={{ display: "grid", gap: 7, marginTop: 8 }}><input type="hidden" name="client_id" value={clientId} /><select name="goal_id" style={field}><option value="">Whole coaching plan</option>{active.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select><select name="category" style={field}>{BARRIER_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select><textarea name="detail" required placeholder="What is getting in the way?" style={area} /><textarea name="coach_response" placeholder="Agreed response or experiment" style={area} /><button style={button}>Record barrier</button></form></details>}
        </div>
      </div>
    </section>
  );
}
