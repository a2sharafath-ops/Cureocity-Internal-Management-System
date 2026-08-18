"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { deleteTask, remindTask, setTaskProject, setTaskStatus } from "@/lib/actions";
import SegTabs from "@/components/SegTabs";

export type TaskRow = {
  id: string; title: string; type: string; priority: string; status: string;
  due_date: string | null; assigneeId: string | null; assignee: string | null;
  clientId: string | null; clientName: string | null; leadId?: string | null; leadName?: string | null;
  projectId?: string | null; projectName?: string | null;
};
type Project = { id: string; name: string; status: string; dueDate: string | null; owner: string | null };
type Bucket = "all" | "open" | "attention" | "blocked" | "doing" | "completed";
type Scope = "all" | "mine" | "unassigned";

function routeDefaults(pathname: string): { view: "projects" | "tasks"; bucket: Bucket; project: string; scope: Scope; date: string } {
  const projectMatch = pathname.match(/^\/tasks\/project\/([^/]+)$/);
  if (projectMatch) return { view: "tasks", bucket: "open", project: projectMatch[1], scope: "all", date: "all" };
  if (pathname === "/tasks/overdue") return { view: "tasks", bucket: "open", project: "all", scope: "all", date: "overdue" };
  if (pathname === "/tasks/unassigned") return { view: "tasks", bucket: "open", project: "all", scope: "unassigned", date: "all" };
  if (pathname === "/tasks/all" || pathname === "/tasks/open" || pathname === "/tasks/attention" || pathname === "/tasks/blocked" || pathname === "/tasks/doing" || pathname === "/tasks/completed") return { view: "tasks", bucket: pathname.slice(7) as Bucket, project: "all", scope: "all", date: "all" };
  return { view: "projects", bucket: "all", project: "all", scope: "all", date: "all" };
}

const STATUS_LABEL: Record<string, string> = { todo: "To Do", doing: "In Progress", blocked: "Blocked", done: "Done" };
const STATUS_OPTS = ["todo", "doing", "blocked", "done"];
const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
const selectStyle: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff" };
function fmt(date: string | null) { return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—"; }

export default function TasksView({ tasks, today, staff, types, projects = [], currentStaffId }: { tasks: TaskRow[]; today: string; staff: string[]; types: string[]; projects?: Project[]; currentStaffId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const validBucket = (value: string | null): Bucket => ["all", "open", "attention", "blocked", "doing", "completed"].includes(value ?? "") ? value as Bucket : "all";
  const validScope = (value: string | null): Scope => ["all", "mine", "unassigned"].includes(value ?? "") ? value as Scope : "all";
  const initialRoute = routeDefaults(pathname);
  const [view, setView] = useState<"projects" | "tasks">(searchParams.get("view") === "tasks" ? "tasks" : initialRoute.view);
  const [bucket, setBucket] = useState<Bucket>(validBucket(searchParams.get("filter")) === "all" && !searchParams.get("filter") ? initialRoute.bucket : validBucket(searchParams.get("filter")));
  const [scope, setScope] = useState<Scope>(validScope(searchParams.get("scope")) === "all" && !searchParams.get("scope") ? initialRoute.scope : validScope(searchParams.get("scope")));
  const [projectF, setProjectF] = useState(searchParams.get("project") ?? initialRoute.project);
  const [dateF, setDateF] = useState(searchParams.get("date") ?? initialRoute.date);
  const [typeF, setTypeF] = useState(searchParams.get("type") ?? "all");
  const [assigneeF, setAssigneeF] = useState(searchParams.get("assignee") ?? "all");
  const [timeline, setTimeline] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const route = routeDefaults(pathname);
    setView(searchParams.get("view") === "tasks" ? "tasks" : route.view);
    setBucket(searchParams.get("filter") ? validBucket(searchParams.get("filter")) : route.bucket);
    setScope(searchParams.get("scope") ? validScope(searchParams.get("scope")) : route.scope);
    setProjectF(searchParams.get("project") ?? route.project);
    setDateF(searchParams.get("date") ?? route.date);
    setTypeF(searchParams.get("type") ?? "all");
    setAssigneeF(searchParams.get("assignee") ?? "all");
  }, [pathname, searchParams]);

  const isOverdue = (task: TaskRow) => task.status !== "done" && Boolean(task.due_date && task.due_date < today);
  const attention = (task: TaskRow) => task.status !== "done" && (task.status === "blocked" || !task.assigneeId || isOverdue(task));
  const dueText = (task: TaskRow) => {
    if (!task.due_date) return "No due date";
    const days = Math.round((Date.parse(`${task.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    return days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue` : days === 0 ? "Due today" : `In ${days} day${days === 1 ? "" : "s"}`;
  };
  const inBucket = (task: TaskRow) => {
    if (bucket === "all") return true;
    if (bucket === "completed") return task.status === "done";
    if (bucket === "blocked") return task.status === "blocked";
    if (bucket === "doing") return task.status === "doing";
    if (bucket === "attention") return attention(task);
    return task.status !== "done";
  };
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
    open: tasks.filter((task) => task.status !== "done").length,
    attention: tasks.filter(attention).length,
    completed: tasks.filter((task) => task.status === "done").length,
  };
  const overall = {
    total: tasks.length,
    overdue: tasks.filter(isOverdue).length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    unassigned: tasks.filter((task) => task.status !== "done" && !task.assigneeId).length,
    completion: tasks.length ? Math.round((counts.completed / tasks.length) * 100) : 0,
  };
  const openTasks = ({ bucket: nextBucket = "all", project = "all", nextScope = "all", nextDate = "all", nextType = "all", nextAssignee = "all" }: { bucket?: Bucket; project?: string; nextScope?: Scope; nextDate?: string; nextType?: string; nextAssignee?: string } = {}) => {
    setView("tasks");
    setBucket(nextBucket);
    setProjectF(project);
    setScope(nextScope);
    setDateF(nextDate);
    setTypeF(nextType);
    setAssigneeF(nextAssignee);
    const basePath = project !== "all" ? `/tasks/project/${project}` : nextDate === "overdue" ? "/tasks/overdue" : nextScope === "unassigned" ? "/tasks/unassigned" : `/tasks/${nextBucket}`;
    const defaultRoute = routeDefaults(basePath);
    const params = new URLSearchParams();
    if (nextBucket !== defaultRoute.bucket) params.set("filter", nextBucket);
    if (project !== defaultRoute.project) params.set("project", project);
    if (nextScope !== defaultRoute.scope) params.set("scope", nextScope);
    if (nextDate !== defaultRoute.date) params.set("date", nextDate);
    if (nextType !== "all") params.set("type", nextType);
    if (nextAssignee !== "all") params.set("assignee", nextAssignee);
    router.push(params.size ? `${basePath}?${params.toString()}` : basePath);
  };
  const openProjects = () => { setView("projects"); router.push("/tasks"); };
  const chooseProject = (id: string) => openTasks({ bucket: "open", project: id });
  const selectedProject = projectF === "inbox" ? { name: "Operations inbox" } : projects.find((project) => project.id === projectF);
  const taskViewTitle = selectedProject?.name ?? (dateF === "overdue" ? "Overdue tasks" : bucket === "blocked" ? "Blocked tasks" : bucket === "doing" ? "In progress tasks" : bucket === "attention" ? "Tasks needing attention" : bucket === "completed" ? "Completed tasks" : scope === "unassigned" ? "Unassigned tasks" : bucket === "open" ? "Open tasks" : "All tasks");
  const projectTasks = selectedProject ? tasks.filter((task) => projectF === "inbox" ? !task.projectId : task.projectId === projectF) : [];
  const dueSoon = (task: TaskRow) => {
    if (task.status === "done" || !task.due_date) return false;
    const days = Math.round((Date.parse(`${task.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    return days >= 0 && days <= 7;
  };

  return <div>
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <SegTabs active={view} onSelect={(key) => key === "projects" ? openProjects() : openTasks()} items={[{ key: "projects", label: "Projects" }, { key: "tasks", label: "All tasks" }]} />
      <span style={{ flex: 1 }} />{view === "tasks" && <button type="button" onClick={() => setTimeline((value) => !value)} style={{ border: "1px solid var(--border)", background: timeline ? "var(--brand-fill)" : "#fff", color: timeline ? "#fff" : "var(--muted)", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Timeline</button>}
    </div>
    {view === "tasks" && <><div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: selectedProject ? 10 : 14, flexWrap: "wrap" }}><b style={{ fontSize: 16 }}>{taskViewTitle}</b><span style={{ color: "var(--muted)", fontSize: 12 }}>{rows.length} task{rows.length === 1 ? "" : "s"} in this view</span><button type="button" onClick={openProjects} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--brand-text)", fontSize: 12.5, fontWeight: 650, cursor: "pointer" }}>← Projects overview</button></div>{selectedProject && <div aria-label="Project task filters" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>{[
      { label: "Open", value: projectTasks.filter((task) => task.status !== "done").length, action: () => openTasks({ bucket: "open", project: projectF }) },
      { label: "In progress", value: projectTasks.filter((task) => task.status === "doing").length, action: () => openTasks({ bucket: "doing", project: projectF }) },
      { label: "Due soon", value: projectTasks.filter(dueSoon).length, action: () => openTasks({ bucket: "open", project: projectF, nextDate: "week" }) },
      { label: "Overdue", value: projectTasks.filter(isOverdue).length, action: () => openTasks({ bucket: "open", project: projectF, nextDate: "overdue" }) },
      { label: "Completed", value: projectTasks.filter((task) => task.status === "done").length, action: () => openTasks({ bucket: "completed", project: projectF }) },
    ].map((item) => <button type="button" key={item.label} onClick={item.action} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 9, padding: "7px 10px", fontSize: 12.5, color: "var(--ink)", cursor: "pointer" }}><b>{item.value}</b> {item.label}</button>)}</div>}</>}
    {view === "projects" && <section aria-label="Projects" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 16 }}>
      <div style={{ ...box, padding: 16, gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}><b style={{ fontSize: 16 }}>Projects overview</b><span style={{ color: "var(--muted)", fontSize: 12 }}>{projects.length} active project{projects.length === 1 ? "" : "s"} · overall delivery health across Cureocity work.</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 14 }}>
          {[
            { label: "Total tasks", value: overall.total, onClick: () => openTasks() },
            { label: `Completed · ${overall.completion}%`, value: counts.completed, onClick: () => openTasks({ bucket: "completed" }) },
            { label: "Overdue", value: overall.overdue, alert: true, onClick: () => openTasks({ bucket: "open", nextDate: "overdue" }) },
            { label: "Blocked", value: overall.blocked, alert: true, onClick: () => openTasks({ bucket: "blocked" }) },
            { label: "Unassigned", value: overall.unassigned, alert: true, onClick: () => openTasks({ bucket: "open", nextScope: "unassigned" }) },
          ].map((item) => <button type="button" key={item.label} onClick={item.onClick} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: item.alert && Number(item.value) > 0 ? "var(--red-bg)" : "#fff", textAlign: "left", cursor: "pointer" }}><div style={{ fontWeight: 800, fontSize: 20, color: item.alert && Number(item.value) > 0 ? "var(--red)" : "var(--ink)" }}>{item.value}</div><div style={{ color: "var(--muted)", fontSize: 11.5, fontWeight: 650 }}>{item.label}</div></button>)}
        </div>
      </div>
      {projects.filter((project) => project.status !== "completed").map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id && task.status !== "done");
        return <button key={project.id} type="button" onClick={() => chooseProject(project.id)} style={{ ...box, padding: 14, textAlign: "left", cursor: "pointer" }}><div style={{ display: "flex", gap: 8 }}><b>{project.name}</b><span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 11 }}>{project.status === "on_hold" ? "On hold" : "Active"}</span></div><div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>{projectTasks.length} open · {projectTasks.filter(attention).length} need attention{project.owner ? ` · ${project.owner}` : ""}</div>{project.dueDate && <div style={{ marginTop: 5, color: "var(--muted)", fontSize: 12 }}>Target {fmt(project.dueDate)}</div>}</button>;
      })}
      {tasks.some((task) => !task.projectId && task.status !== "done") && <button type="button" onClick={() => chooseProject("inbox")} style={{ ...box, padding: 14, textAlign: "left", cursor: "pointer", borderStyle: "dashed" }}><b>Operations inbox</b><div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>{tasks.filter((task) => !task.projectId && task.status !== "done").length} ungrouped client, lead, and operational tasks</div></button>}
      {projects.length === 0 && <div style={{ ...box, padding: 18, color: "var(--muted)", fontSize: 13, gridColumn: "1 / -1" }}>No projects yet. Create one for a launch, campaign, or event—or use <b>Organize current tasks</b> to create the three safe operational groupings.</div>}
    </section>}
    {view === "tasks" && <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <select value={scope} onChange={(event) => openTasks({ bucket, project: projectF, nextScope: event.target.value as Scope, nextDate: dateF, nextType: typeF, nextAssignee: assigneeF })} style={selectStyle}><option value="all">Everyone’s tasks</option>{currentStaffId && <option value="mine">My tasks</option>}<option value="unassigned">Unassigned</option></select>
      {projects.length > 0 && <select value={projectF} onChange={(event) => openTasks({ bucket, project: event.target.value, nextScope: scope, nextDate: dateF, nextType: typeF, nextAssignee: assigneeF })} style={selectStyle}><option value="all">All projects</option><option value="inbox">Operations inbox</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
      <select value={dateF} onChange={(event) => openTasks({ bucket, project: projectF, nextScope: scope, nextDate: event.target.value, nextType: typeF, nextAssignee: assigneeF })} style={selectStyle}><option value="all">All dates</option><option value="today">Due today</option><option value="week">Next 7 days</option><option value="overdue">Overdue</option></select>
      <select value={typeF} onChange={(event) => openTasks({ bucket, project: projectF, nextScope: scope, nextDate: dateF, nextType: event.target.value, nextAssignee: assigneeF })} style={selectStyle}><option value="all">All task types</option>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <select value={assigneeF} onChange={(event) => openTasks({ bucket, project: projectF, nextScope: scope, nextDate: dateF, nextType: typeF, nextAssignee: event.target.value })} style={selectStyle}><option value="all">All assignees</option>{staff.map((person) => <option key={person} value={person}>{person}</option>)}</select>
      <span style={{ flex: 1 }} /><span style={{ color: "var(--muted)", fontSize: 13 }}>Showing {rows.length} task{rows.length === 1 ? "" : "s"}</span>
    </div>}
    {view === "tasks" && (timeline ? <div style={{ ...box, padding: "8px 18px" }}>{rows.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No tasks in this view.</div>}{rows.map((task, index) => <div key={task.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: index ? "1px solid var(--border)" : "none" }}><div style={{ width: 70, color: "var(--muted)", fontSize: 12 }}>{fmt(task.due_date)}</div><div style={{ width: 10, height: 10, borderRadius: "50%", background: isOverdue(task) ? "var(--red)" : "var(--brand-fill)", marginTop: 3 }} /><div><b>{task.title}</b><div style={{ fontSize: 12, color: "var(--muted)" }}>{task.projectName ?? "Operations inbox"} · {task.assignee ?? "Unassigned"} · {dueText(task)}</div></div></div>)}</div> : <div style={{ ...box, overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}><thead><tr>{["Task", "Project", "Assignee", "Due", "Linked record", "Status", ""].map((label) => <th key={label} style={{ padding: "11px 16px", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{label}</th>)}</tr></thead><tbody>
      {rows.map((task) => <Fragment key={task.id}><tr style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: "12px 16px", fontSize: 13 }}><b>{task.title}</b><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{task.type} · {task.priority}</div></td><td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{task.projectName ?? "Operations inbox"}</td><td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>{task.assignee ?? "Unassigned"}</td><td style={{ padding: "12px 16px", fontSize: 13, color: isOverdue(task) ? "var(--red)" : "var(--muted)" }}>{fmt(task.due_date)}<div style={{ fontSize: 11.5 }}>{dueText(task)}</div></td><td style={{ padding: "12px 16px", fontSize: 13 }}>{task.clientId ? <Link href={`/clients/${task.clientId}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{task.clientName}</Link> : task.leadId ? <Link href={`/leads/${task.leadId}`} style={{ color: "var(--brand-text)", textDecoration: "none", fontWeight: 600 }}>{task.leadName} <span style={{ color: "var(--muted)", fontSize: 11 }}>· lead</span></Link> : <span style={{ color: "var(--muted)" }}>—</span>}</td><td style={{ padding: "12px 16px", fontSize: 13 }}><form action={setTaskStatus}><input type="hidden" name="id" value={task.id} /><select name="status" defaultValue={task.status} onChange={(event) => event.currentTarget.form?.requestSubmit()} style={{ ...selectStyle, padding: "6px 8px" }}>{STATUS_OPTS.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select></form></td><td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}><button type="button" onClick={() => setOpen(open === task.id ? null : task.id)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>View</button>{" "}<form action={remindTask} style={{ display: "inline" }}><input type="hidden" name="id" value={task.id} /><button title="Send reminder" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 9px", fontSize: 13, cursor: "pointer" }}>🔔</button></form></td></tr>{open === task.id && <tr style={{ background: "#fafafa" }}><td colSpan={7} style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}><div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}><span><b style={{ color: "var(--ink)" }}>{task.title}</b> · {task.assignee ?? "Unassigned"} · due {fmt(task.due_date)}</span><form action={setTaskProject} style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="hidden" name="id" value={task.id} /><label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>Project</label><select name="project_id" defaultValue={task.projectId ?? ""} onChange={(event) => event.currentTarget.form?.requestSubmit()} style={{ ...selectStyle, padding: "5px 8px", fontSize: 12 }}><option value="">Operations inbox</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></form><form action={deleteTask} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={task.id} /><button style={{ border: "1px solid #fecaca", background: "#fff", color: "var(--red)", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Delete task</button></form></div></td></tr>}</Fragment>)}
      {rows.length === 0 && <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)" }}>No tasks in this view.</td></tr>}
    </tbody></table></div>)}
  </div>;
}
