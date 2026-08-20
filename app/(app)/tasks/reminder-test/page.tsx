import Link from "next/link";

export default function ControlledTaskReminderPage() {
  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Controlled task-reminder test</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.55, margin: "0 0 18px" }}>
        Runs the real task-reminder engine for the single opted-in staff contact only. It does not run renewals,
        care follow-ups, lead escalations, or the rest of the daily automation suite.
      </p>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow)", padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 750, marginBottom: 6 }}>Safety boundary</div>
        <ul style={{ color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6, margin: "0 0 16px", paddingLeft: 20 }}>
          <li>Refuses to run unless exactly one WhatsApp reminder contact is opted in.</li>
          <li>Suppresses management-wide escalation and all other staff recipients.</li>
          <li>Uses the normal automation-event ledger, so a repeat run verifies duplicate suppression.</li>
        </ul>
        <form action="/api/cron/task-reminders" method="post">
          <button type="submit" style={{ border: 0, borderRadius: 10, background: "var(--brand)", color: "white", fontWeight: 750, padding: "10px 15px", cursor: "pointer" }}>
            Run controlled test
          </button>
        </form>
      </div>
      <Link href="/tasks" style={{ display: "inline-block", marginTop: 16, color: "var(--brand)", fontSize: 12.5, fontWeight: 700 }}>
        ← Back to Tasks
      </Link>
    </div>
  );
}
