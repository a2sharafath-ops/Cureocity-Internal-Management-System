"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { deleteTask, remindTask, setTaskProject, setTaskStatus } from "@/lib/actions";
import SegTabs from "@/components/SegTabs";

export type TaskRow = {
  id: string; title: string; type: string; priority: string; status: string;
  due_date: string | null; assigneeId: string | null; assignee: string | null;
  clientId: string | null; clientName: string | null; leadId?: string | null; leadName?: string | null;
  projectId?: string | null; projectName?: string | null;
};
type Project = { id: string; name: string; status: string; dueDate: string | null; owner: string | null };

const STATUS_LABEL: Record<string, string> = { todo: "To Do", doing: "In Progress", blocked: "Blocked", done: "Done" };
const STATUS_OPTS = ["todo", "doing", "blocked", "done"];
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const selectStyle: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
function fmt(date: string | null) { return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—"; }

export default function TasksView({ tasks, today, staff, types, projects = [], currentStaffId }: { tasks: TaskRow[]; today: string; staff: string[]; types: string[]; projects?: Project[]; currentStaffId: string | null }) {
  const [view, setView] = useState<"projects" | "tasks">("projects");
  const [bucket, setBucket] = useState<"open" | "attention" | "completed">("open");
  const [scope, setScope] = useState<"all" | "mine" | "unassigned">("all");
  const [projectF, setProjectF] = useState("all");
  const [dateF, setDateF] = useState("all");
  const [typeF, setTypeF] = useState("all");
  const [assigneeF, setAssigneeF] = useState("all");
  const [timeline, setTimeline] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const isOverdue = (task: TaskRow) => task.status !== "done" && Boolean(task.due_date && task.due_date < today);
  const attention = (task: TaskRow) => task.status !== "done" && (task.status === "blocked" || !task.assigneeId || isOverdue(task));
  const dueText = (task: TaskRow) => {
    if (!task.due_date) return "No due date";
    const days = Math.round((Date.parse(`${task.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    return days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `In ${days} day${days === 1 ? "" : "s"}`;
  };
  const inBucket = (task: TaskRow) => bucket === "completed" ? task.status === "done" : bucket === "attention" ? attention(task) : task.status !== "done" && task.status !== "blocked" && !isOverdue(task);
  const matchDate = (task: TaskRow) => {
    if (dateF === "all") return true;
    if (!task.due_date) return false;
    const days = Math.round((Date.parse(`${task.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    return dateF === "today" ? days === 0 : dateF === "week" ? days >= 0 && days <= 7 : days < 0;
  };
  const rows = tasks.filter(inBucket)
    .filter((task) => scope === "all" || (scope === "mine" ? Boolean(currentStaffId && task.assigneeId === currentStaffId) : !task.assigneeId))
    .filter((task) => projectF === "all" || (projectF === "inbox" ? !task.projectId : task.projectId === projectF))
    .filter((task) => typeF === "all" || task.type === typeF)
    .filter((task) => assigneeF === "all" || task.assignee === assigneeF)
    .filter(matchDate)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const counts = {
    open: tasks.filter((task) => task.status !== "done" && task.status !== "blocked" && !isOverdue(task)).length,
    attention: tasks.filter(attention).length,
    completed: tasks.filter((task) => task.status === "done").length,
  };
  const chooseProject = (id: string) => { setProjectF(id); setView("tasks"); setBucket("open"); };
  const metric = (label: string, value: number, select: () => void, red = false) => <button type="button" onClick={select} style={{ textAlign: "left", minWidth: 126, border: "1px solid var(--border)", background: red ? "var(--red-bg)" : "var(--card)", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}><div style={{ fontSize: 20, fontWeight: 800, color: red ? "var(--red)" : "var(--ink)" }}>{value}</div><div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 650 }}>{label}</div></button>;

  return <div>
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <SegTabs active={view} onSelect={(key) => setView(key as typeof view)} items={[{ key: "projects", label: "Projects" }, { key: "tasks", label: "All tasks" }]} />
      <span style={{ flex: 1 }} /><button type="button" onClick={() => setTimeline((value) => !value)} style={{ border: "1px solid var(--border)", background: timeline ? "var(--brand-fill)" : "#fff", color: timeline ? "#fff" : "var(--muted)", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Timeline</button>
    </div>
    <section aria-label="Task health" style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
      {metric("Open", counts.open, () => { setBucket("open"); setScope("all"); })}
      {metric("Needs attention", counts.attention, () => { setBucket("attention"); setScope("all"); }, true)}
      {metric("Completed", counts.completed, () => { setBucket("completed"); setScope("all"); })}
    </section>
    {view === "projects" && <section aria-label="Projects" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 16 }}>
      {projects.filter((project) => project.status !== "completed").map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id && task.status !== "done");
        return <button key={project.id} type="button" onClick={() => chooseProject(project.id)} style={{ ...box, padding: 14, textAlign: "left", cursor: "pointer" }}><div style={{ display: "flex", gap: 8 }}><b>{project.name}</b><span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 11 }}>{project.status === "on_hold" ? "On hold" : "Active"}</span></div><div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>{projectTasks.length} open · {projectTasks.filter(attention).length} need attention{project.owner ? ` · ${project.owner}` : ""}</div>{project.dueDate && <div style={{ marginTop: 5, color: "var(--muted)", fontSize: 12 }}>Target {fmt(project.dueDate)}</div>}</button>;
      })}
      {tasks.some((task) => !task.projectId && task.status !== "done") && <button type="button" onClick={() => chooseProject("inbox")} style={{ ...box, padding: 14, textAlign: "left", cursor: "pointer", borderStyle: "dashed" }}><b>Operations inbox</b><div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>{tasks.filter((task) => !task.projectId && task.status !== "done").length} ungrouped client, lead, and operational tasks</div></button>}
      {projects.length === 0 && <div style={{ ...box, padding: 18, color: "var(--muted)", fontSize: 13, gridColumn: "1 / -1" }}>No projects yet. Create one for a launch, campaign, or event—or use <b>Organize current tasks</b> to create the three safe operational groupings.</div>}
    </section>}
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} style={selectStyle}><option value="all">Everyone’s tasks</option>{currentStaffId && <option value="mine">My tasks</option>}<option value="unassigned">Unassigned</option></select>
      {projects.length > 0 && <select value={projectF} onChange={(event) => { setProjectF(event.target.value); setView("tasks"); }} style={selectStyle}><option value="all">All projects</option><option value="inbox">Operations inbox</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
      <select value={dateF} onChange={(event) => setDateF(event.target.value)} style={selectStyle}><option value="all">All dates</option><option value="today">Due today</option><option value="week">Next 7 days</option><option value="overdue">Overdue</option></select>
      <select value={typeF} onChange={(event) => setTypeF(event.target.value)} style={selectStyle}><option value="all">All task types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <select value={assigneeF} onChange={(event) => setAssigneeF(event.target.value)} style={selectStyle}><option value="all">All assignees</option>{staff.map((person) => <option key={person} value={person}>{person}</option>)}</select>
      <span style={{ flex: 1 }} /><span style={{ color: "var(--muted)", fontSize: 13 }}>Showing {rows.length} task{rows.length === 1 ? "" : "s"}</span>
    </div>
    {timeline ? <div style={{ ...box, padding: "8px 18px" }}>{rows.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No tasks in this view.</div>}{rows.map((task, index) => <div key={task.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: index ? "1px solid var(--border)" : "none" }}><div style={{ width: 70, color: "var(--muted)", fontSize: 12 }}>{fmt(task.due_date)}</div><div style={{ width: 10, height: 10, borderRadius: "50%", background: isOverdue(task) ? "var(--red)" : "var(--brand-fill)", marginTop: 3 }} /><div><b>{task.title}</b><div style={{ fontSize: 12, color: "var(--muted)" }}>{task.projectName ?? "Operations inbox"} · {task.assignee ?? "Unassigned"} · {dueText(task)}</div></div></div>)}</div> : <div style={{ ...box, overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}><thead><tr>{["Task", "Project", "Assignee", "Due", "Linked record", "Status", ""].map((label) => <th key={label} style={{ padding: "11px 16px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{label}</th>)}</tr></thead><tbody>
      {rows.map((task) => <Fragment key={task.id}><tr style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: "12px 16px", fontSize: 13 }}><b>{task.title}</b><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{task.type} · {task.priority}</div></td><td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{task.projectName ?? "Operations inbox"}</td><td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{task.assignee ?? "Unassigned"}</td><td style={{ padding: "12px 16px", fontSize: 13, color: isOverdue(task) ? "var(--red)" : "var(--muted)" }}>{fmt(task.due_date)}<div style={{ fontSize: 11.5 }}>{dueText(task)}</div></td><td style={{ padding: "12px 16px", fontSize: 13 }}>{task.clientId ? <Link href={`/clients/${task.clientId}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{task.clientName}</Link> : task.leadId ? <Link href={`/leads/${task.leadId}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{task.leadName} <span style={{ color: "var(--muted)", fontSize: 11 }}>· lead</span></Link> : <span style={{ color: "var(--muted)" }}>—</span>}</td><td style={{ padding: "12px 16px", fontSize: 13 }}><form action={setTaskStatus}><input type="hidden" name="id" value={task.id} /><select name="status" defaultValue={task.status} onChange={(event) => event.currentTarget.form?.requestSubmit()} style={{ ...selectStyle, padding: "6px 8px" }}>{STATUS_OPTS.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></form></td><td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}><button type="button" onClick={() => setOpen(open === task.id ? null : task.id)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View</button>{" "}<form action={remindTask} style={{ display: "inline" }}><input type="hidden" name="id" value={task.id} /><button title="Send reminder" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 9px", fontSize: 13, cursor: "pointer" }}>🔔</button></form></td></tr>{open === task.id && <tr style={{ background: "#fafafa" }}><td colSpan={7} style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}><b style={{ color: "var(--ink)" }}>{task.title}</b> · {task.projectName ?? "Operations inbox"} · {task.assignee ?? "Unassigned"} · due {fmt(task.due_date)}<form action={deleteTask} style={{ display: "inline", marginLeft: 12 }}><input type="hidden" name="id" value={task.id} /><button style={{ border: "1px solid #fecaca", background: "#fff", color: "var(--red)", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Delete task</button></form></td></tr>}</Fragment>)}
      {rows.length === 0 && <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>No tasks in this view.</td></tr>}
    </tbody></table></div>}
  </div>;
}
