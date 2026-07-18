"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { setTaskStatus, remindTask, deleteTask } from "@/lib/actions";
import SegTabs from "@/components/SegTabs";

export type TaskRow = {
  id: string; title: string; type: string; priority: string; status: string;
  due_date: string | null; assignee: string | null; clientId: string | null; clientName: string | null;
};

const STATUS_LABEL: Record<string, string> = { todo: "To Do", doing: "In Progress", blocked: "Blocked", done: "Done" };
const STATUS_OPTS = ["todo", "doing", "blocked", "done"];

function daysRemaining(due: string | null, today: string): { text: string; overdue: boolean } {
  if (!due) return { text: "—", overdue: false };
  const d = Math.round((Date.parse(due + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
  if (d < 0) return { text: `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`, overdue: true };
  if (d === 0) return { text: "Due today", overdue: false };
  return { text: `In ${d} day${d === 1 ? "" : "s"}`, overdue: false };
}
function fmt(iso: string | null) { return iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—"; }

export default function TasksView({ tasks, today, staff, types }: { tasks: TaskRow[]; today: string; staff: string[]; types: string[] }) {
  const [tab, setTab] = useState<"upcoming" | "overdue" | "completed">("upcoming");
  const [dateF, setDateF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [assigneeF, setAssigneeF] = useState("all");
  const [timeline, setTimeline] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const inTab = (t: TaskRow) => {
    const overdue = t.status !== "done" && t.due_date && t.due_date < today;
    if (tab === "completed") return t.status === "done";
    if (tab === "overdue") return !!overdue;
    return t.status !== "done" && !overdue; // upcoming
  };
  const counts = {
    upcoming: tasks.filter((t) => t.status !== "done" && !(t.due_date && t.due_date < today)).length,
    overdue: tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date < today).length,
    completed: tasks.filter((t) => t.status === "done").length,
  };
  const matchDate = (t: TaskRow) => {
    if (dateF === "all" || !t.due_date) return dateF === "all";
    const d = Math.round((Date.parse(t.due_date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
    if (dateF === "today") return d === 0;
    if (dateF === "week") return d >= 0 && d <= 7;
    if (dateF === "overdue") return d < 0;
    return true;
  };
  const rows = tasks.filter(inTab)
    .filter((t) => typeF === "all" || t.type === typeF)
    .filter((t) => assigneeF === "all" || t.assignee === assigneeF)
    .filter(matchDate)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "11px 16px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3px" };
  const td: React.CSSProperties = { padding: "12px 16px", fontSize: 13, verticalAlign: "top" };
  const sel: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
  const prioColor = (p: string) => p === "High" ? "var(--red)" : p === "Medium" ? "#b45309" : "var(--muted)";
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <SegTabs active={tab} onSelect={(k) => setTab(k as typeof tab)} items={[
          { key: "upcoming", label: "⏳ Upcoming", count: counts.upcoming },
          { key: "overdue", label: "⚠️ Overdue", count: counts.overdue },
          { key: "completed", label: "✅ Completed", count: counts.completed },
        ]} />
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setTimeline((v) => !v)} style={{ border: "1px solid var(--border)", background: timeline ? "var(--teal)" : "#fff", color: timeline ? "#fff" : "var(--muted)", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🗓 Smart Timeline View</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select value={dateF} onChange={(e) => setDateF(e.target.value)} style={sel}><option value="all">All Dates</option><option value="today">Due today</option><option value="week">Next 7 days</option><option value="overdue">Overdue</option></select>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={sel}><option value="all">All Tasks</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)} style={sel}><option value="all">All Assignees</option>{staff.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <span style={{ flex: 1 }} />
        <span style={{ color: "var(--muted)", fontSize: 13 }}>Showing {rows.length} task{rows.length === 1 ? "" : "s"}</span>
      </div>

      {timeline ? (
        <div style={{ ...box, padding: "8px 18px" }}>
          {rows.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No tasks.</div>}
          {rows.map((t, i) => { const dr = daysRemaining(t.due_date, today); return (
            <div key={t.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 70, color: "var(--muted)", fontSize: 12, flexShrink: 0 }}>{fmt(t.due_date)}</div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: dr.overdue ? "var(--red)" : "var(--teal)", marginTop: 3, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 13.5 }}>{t.title}</b>
                <div style={{ fontSize: 12, color: "var(--muted)" }}><span style={{ color: prioColor(t.priority), fontWeight: 700 }}>{t.priority}</span> · {t.type} · {t.assignee ?? "Unassigned"} · <span style={{ color: dr.overdue ? "var(--red)" : "var(--muted)" }}>{dr.text}</span></div>
              </div>
            </div>
          ); })}
        </div>
      ) : (
        <div style={{ ...box, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr><th style={th}>Title</th><th style={th}>Assignee</th><th style={th}>Due</th><th style={th}>Days remaining</th><th style={th}>Linked client</th><th style={th}>Status</th><th style={th} /></tr></thead>
            <tbody>
              {rows.map((t) => { const dr = daysRemaining(t.due_date, today); return (
                <Fragment key={t.id}>
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={td}><b style={{ fontSize: 13.5 }}>{t.title}</b><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.type} · <span style={{ color: prioColor(t.priority), fontWeight: 700 }}>{t.priority}</span></div></td>
                    <td style={{ ...td, color: "var(--muted)" }}>{t.assignee ?? "Unassigned"}</td>
                    <td style={{ ...td, color: "var(--muted)" }}>{fmt(t.due_date)}</td>
                    <td style={{ ...td, color: dr.overdue ? "var(--red)" : "var(--muted)", fontWeight: dr.overdue ? 600 : 400 }}>{dr.text}</td>
                    <td style={td}>{t.clientId ? <Link href={`/clients/${t.clientId}`} style={{ color: "var(--teal-dark)", textDecoration: "none", fontWeight: 600 }}>{t.clientName}</Link> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td style={td}>
                      <form action={setTaskStatus}>
                        <input type="hidden" name="id" value={t.id} />
                        <select name="status" defaultValue={t.status} onChange={(e) => e.currentTarget.form?.requestSubmit()} style={{ ...sel, padding: "6px 8px" }}>
                          {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </form>
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View</button>{" "}
                      <form action={remindTask} style={{ display: "inline" }}><input type="hidden" name="id" value={t.id} /><button title="Send reminder" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 9px", fontSize: 13, cursor: "pointer" }}>🔔</button></form>
                    </td>
                  </tr>
                  {open === t.id && (
                    <tr style={{ background: "#fafafa" }}>
                      <td colSpan={7} style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
                        <b style={{ color: "var(--ink)" }}>{t.title}</b> · {t.type} · {t.priority} priority · {t.assignee ?? "Unassigned"}{t.clientName ? ` · client: ${t.clientName}` : ""} · due {fmt(t.due_date)} · status {STATUS_LABEL[t.status]}
                        <form action={deleteTask} style={{ display: "inline", marginLeft: 12 }}><input type="hidden" name="id" value={t.id} /><button style={{ border: "1px solid #fecaca", background: "#fff", color: "var(--red)", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Delete task</button></form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ); })}
              {rows.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "24px 16px" }}>No tasks in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
