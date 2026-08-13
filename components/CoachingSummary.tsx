import type { CoachProgrammeLifecycle } from "@/lib/coach-programme-lifecycle";
import type { CoachingAdherenceView, CoachingBarrierView, CoachingGoalView } from "@/components/HealthCoachGoalsPanel";

export default function CoachingSummary({ lifecycle, baselinePercent, goals, events, barriers }: {
  lifecycle: CoachProgrammeLifecycle | null;
  baselinePercent: number;
  goals: CoachingGoalView[];
  events: CoachingAdherenceView[];
  barriers: CoachingBarrierView[];
}) {
  const activeGoals = goals.filter((goal) => goal.status === "Active");
  const openBarriers = barriers.filter((barrier) => barrier.status !== "Resolved");
  const reviewed = events.filter((event) => event.outcome === "Completed" || event.outcome === "Missed");
  const completed = reviewed.filter((event) => event.outcome === "Completed").length;
  const adherence = reviewed.length ? `${Math.round((completed / reviewed.length) * 100)}%` : "No reviewed events";
  return <section style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 16 }}>
    <div style={{ fontWeight: 750 }}>Health coaching summary</div>
    <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 2 }}>Read-only coordination view. Detailed coaching records are managed by the Health Coach.</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 12, fontSize: 12 }}>
      <div><b>Programme</b><div>{lifecycle?.status ?? "Not recorded"}</div>{lifecycle?.next_contact_date && <div style={{ color: "var(--muted)" }}>Next contact {lifecycle.next_contact_date}</div>}</div>
      <div><b>Baseline</b><div>{baselinePercent}% complete</div></div>
      <div><b>Goals</b><div>{activeGoals.length} active</div></div>
      <div><b>Adherence</b><div>{adherence}</div></div>
      <div><b>Barriers</b><div>{openBarriers.length} open</div></div>
    </div>
  </section>;
}
