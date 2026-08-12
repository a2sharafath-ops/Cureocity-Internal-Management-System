"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { addMdtHuddle, updateMdtTask, type MdtHuddleActionState } from "@/lib/actions";
import { isAdminish } from "@/lib/roles";
import {
  MDT_BARRIERS, MDT_ISSUES, MDT_OWNER_ROLES, MDT_PROGRESS, MDT_REFERRALS,
  MDT_SAFETY, MDT_TASK_PRIORITY, MDT_TASK_STATUS,
} from "@/lib/mdt";
import { disciplineLabel } from "@/lib/disciplines";

export type MdtRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  author: string | null;
  body: string;
  escalated: boolean;
  to_role: string | null;
  status: string | null;
  created_at: string;
};

export type MdtHuddleRow = {
  id: string;
  client_id: string;
  client_name: string;
  huddle_date: string;
  current_plan: string;
  progress_status: string;
  progress_reason: string;
  issue_category: string;
  new_issue: string | null;
  barrier_category: string;
  barrier_detail: string | null;
  safety_status: string;
  referral_status: string;
  today_owner_role: string;
  coach_next_move: string;
  team_decision_required: boolean;
  team_decision: string | null;
  author_name: string;
  created_at: string;
};

export type MdtTaskRow = {
  id: string;
  client_id: string;
  client_name: string;
  owner_role: string;
  assigned_to_staff_id: string | null;
  assigned_name: string | null;
  task: string;
  due_date: string;
  priority: string;
  status: string;
  decision: string | null;
  created_by: string;
  creator_name: string;
  updated_at: string;
};

const box: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
};
const input: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px",
  fontSize: 13, background: "#fff", width: "100%", font: "inherit",
};
const label: React.CSSProperties = {
  display: "grid", gap: 4, color: "var(--muted)", fontSize: 11.5, fontWeight: 650,
};
const primary: React.CSSProperties = {
  background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8,
  padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
};

const fmt = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const progressTone: Record<string, React.CSSProperties> = {
  Green: { background: "var(--green-bg)", color: "var(--green-text)" },
  Amber: { background: "var(--amber-bg)", color: "var(--amber-text)" },
  Red: { background: "var(--red-bg)", color: "var(--red-text)" },
};

function HuddleForm({ clients, today, onSaved }: { clients: { id: string; name: string }[]; today: string; onSaved: () => void }) {
  const [state, action] = useActionState<MdtHuddleActionState, FormData>(addMdtHuddle, {});
  const [issue, setIssue] = useState("None");
  const [barrier, setBarrier] = useState("None");
  const [safety, setSafety] = useState("None");
  const [decision, setDecision] = useState(false);
  useEffect(() => { if (state.ok) onSaved(); }, [state.ok, onSaved]);

  return (
    <form action={action} style={{ ...box, padding: 16, marginBottom: 16, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontWeight: 750 }}>Daily MDT huddle</div>
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>One shared view, one owner and one dated action. Clinical plans remain owned by their respective professionals.</div>
      </div>
      {state.error && <div style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 8, padding: "9px 11px", fontSize: 12, fontWeight: 650 }}>{state.error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <label style={label}>Client
          <select name="client_id" required defaultValue="" style={input}><option value="" disabled>Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        </label>
        <label style={label}>Progress
          <select name="progress_status" defaultValue="Green" style={input}>{MDT_PROGRESS.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
      </div>
      <label style={label}>Current care-team plan
        <textarea name="current_plan" required rows={2} style={{ ...input, resize: "vertical" }} placeholder="Doctor, dietitian and trainer plans currently being followed" />
      </label>
      <label style={label}>Objective reason for the progress colour
        <textarea name="progress_reason" required rows={2} style={{ ...input, resize: "vertical" }} placeholder="What changed, using recorded behaviour, attendance or outcomes" />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <label style={label}>New issue
          <select name="issue_category" value={issue} onChange={(event) => setIssue(event.target.value)} style={input}>{MDT_ISSUES.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
        <label style={label}>Barrier
          <select name="barrier_category" value={barrier} onChange={(event) => setBarrier(event.target.value)} style={input}>{MDT_BARRIERS.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
      </div>
      {(issue !== "None" || barrier !== "None") && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {issue !== "None" && <label style={label}>New issue detail<textarea name="new_issue" required rows={2} style={{ ...input, resize: "vertical" }} /></label>}
        {barrier !== "None" && <label style={label}>Barrier detail<textarea name="barrier_detail" required rows={2} style={{ ...input, resize: "vertical" }} /></label>}
      </div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        <label style={label}>Safety
          <select name="safety_status" value={safety} onChange={(event) => setSafety(event.target.value)} style={input}>{MDT_SAFETY.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
        <label style={label}>Referral
          <select name="referral_status" defaultValue="Not required" style={input}>{MDT_REFERRALS.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
        <label style={label}>Today&apos;s owner
          <select name="owner_role" defaultValue="Health Coach" style={input}>{MDT_OWNER_ROLES.map((value) => <option key={value}>{value}</option>)}</select>
        </label>
      </div>
      {safety !== "None" && <div style={{ background: "#fff1f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 11px", fontSize: 12 }}>A huddle never replaces the safety pathway. Open the client&apos;s safety concern on <b>Overview</b> first; this huddle will then reference its active status.</div>}
      <label style={label}>Coach next move
        <textarea name="coach_next_move" required rows={2} style={{ ...input, resize: "vertical" }} placeholder="The one action the Health Coach will take next" />
      </label>
      <label style={{ ...label, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" name="team_decision_required" checked={decision} onChange={(event) => setDecision(event.target.checked)} /> Team decision required
      </label>
      {decision && <label style={label}>Decision required from the team<textarea name="team_decision" required rows={2} style={{ ...input, resize: "vertical" }} /></label>}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 13 }}>
        <div style={{ fontWeight: 750, fontSize: 13 }}>Assign the team action</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 8 }}>
          <label style={label}>Action<textarea name="task" required rows={2} style={{ ...input, resize: "vertical" }} placeholder="Observable action and expected result" /></label>
          <label style={label}>Due date<input type="date" name="due_date" required min={today} defaultValue={today} style={input} /></label>
          <label style={label}>Priority<select name="priority" defaultValue="Routine" style={input}>{MDT_TASK_PRIORITY.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
      </div>
      <div><button style={primary}>Record huddle &amp; assign action</button></div>
    </form>
  );
}

function TaskUpdateForm({ task }: { task: MdtTaskRow }) {
  const [status, setStatus] = useState(task.status);
  const outcomeRequired = ["Completed", "Cancelled"].includes(status);
  return (
    <form action={updateMdtTask} style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 380 }}>
      <input type="hidden" name="id" value={task.id} />
      <select name="status" value={status} onChange={(event) => setStatus(event.target.value)} style={{ ...input, width: "auto" }}>
        {MDT_TASK_STATUS.filter((value) => value !== "Open" || task.status === "Open").map((value) => <option key={value}>{value}</option>)}
      </select>
      <input name="decision" required={outcomeRequired} placeholder={outcomeRequired ? "Decision/outcome required" : "Progress note"} style={{ ...input, width: 180 }} />
      <button style={{ ...primary, padding: "6px 10px" }}>Update</button>
    </form>
  );
}

export default function MdtBoard({
  notes, huddles, tasks, clients, role, userId, staffId, today,
}: {
  notes: MdtRow[];
  huddles: MdtHuddleRow[];
  tasks: MdtTaskRow[];
  clients: { id: string; name: string }[];
  role: string;
  userId: string;
  staffId: string | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const taskRank = (task: MdtTaskRow) => task.due_date < today ? 0 : task.priority === "Urgent" ? 1 : task.priority === "Priority" ? 2 : 3;
  const activeTasks = tasks.filter((task) => !["Completed", "Cancelled"].includes(task.status))
    .sort((a, b) => taskRank(a) - taskRank(b) || a.due_date.localeCompare(b.due_date));
  const closedTasks = tasks.filter((task) => ["Completed", "Cancelled"].includes(task.status));
  const mayUpdate = (task: MdtTaskRow) => isAdminish(role) || task.created_by === userId || task.owner_role === role || (!!staffId && task.assigned_to_staff_id === staffId);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <div><div style={{ fontWeight: 750 }}>MDT huddle &amp; team actions</div><div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>One client view across the doctor, dietitian, trainer, Health Coach and psychologist.</div></div>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setOpen((value) => !value)} style={primary}>{open ? "Cancel" : "+ Record huddle"}</button>
      </div>

      {open && <HuddleForm clients={clients} today={today} onSaved={() => setOpen(false)} />}

      <section style={{ ...box, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8 }}><b style={{ fontSize: 13.5 }}>Open team actions</b><span style={{ background: activeTasks.length ? "var(--amber-bg)" : "var(--green-bg)", color: activeTasks.length ? "var(--amber-text)" : "var(--green-text)", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>{activeTasks.length}</span></div>
        {activeTasks.length ? activeTasks.map((task) => {
          const overdue = task.due_date < today;
          return <div key={task.id} style={{ borderTop: "1px solid var(--border)", padding: "11px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ background: task.priority === "Urgent" || overdue ? "var(--red-bg)" : "var(--amber-bg)", color: task.priority === "Urgent" || overdue ? "var(--red-text)" : "var(--amber-text)", borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750, whiteSpace: "nowrap" }}>{overdue ? "Overdue" : task.priority}</span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 750 }}>{task.client_name} — {task.task}</div><div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 3 }}>{task.assigned_name ?? task.owner_role} · due {fmt(task.due_date)} · {task.status}</div></div>
            <Link href={`/clients/${task.client_id}?tab=timeline`} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", color: "var(--brand-text)", textDecoration: "none", fontSize: 11.5, fontWeight: 700 }}>Client</Link>
            {mayUpdate(task) && <TaskUpdateForm task={task} />}
          </div>;
        }) : <div style={{ borderTop: "1px solid var(--border)", padding: "16px", color: "var(--muted)", fontSize: 12.5 }}>No open MDT actions.</div>}
        {closedTasks.length > 0 && <details style={{ borderTop: "1px solid var(--border)", padding: "10px 16px" }}><summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>Completed/cancelled actions ({closedTasks.length})</summary><div style={{ display: "grid", gap: 7, marginTop: 8 }}>{closedTasks.slice(0, 30).map((task) => <div key={task.id} style={{ fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 7 }}><b>{task.client_name} — {task.task}</b><span style={{ color: "var(--muted)" }}> · {task.status} by {task.assigned_name ?? task.owner_role}{task.decision ? ` · ${task.decision}` : ""}</span></div>)}</div></details>}
      </section>

      <section style={{ ...box, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "12px 16px" }}><b style={{ fontSize: 13.5 }}>Structured huddle record</b></div>
        {huddles.length ? huddles.map((huddle) => <details key={huddle.id} style={{ borderTop: "1px solid var(--border)", padding: "11px 16px" }}>
          <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, listStyle: "none" }}><span style={{ ...progressTone[huddle.progress_status], borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>{huddle.progress_status}</span><b style={{ fontSize: 13 }}>{huddle.client_name}</b><span style={{ color: "var(--muted)", fontSize: 11.5 }}>· {fmt(huddle.huddle_date)} · owner {huddle.today_owner_role}</span></summary>
          <div style={{ display: "grid", gap: 7, marginTop: 10, fontSize: 12.5 }}>
            <div><b>Current plan:</b> {huddle.current_plan}</div><div><b>Progress:</b> {huddle.progress_reason}</div>
            {huddle.issue_category !== "None" && <div><b>New issue — {huddle.issue_category}:</b> {huddle.new_issue}</div>}
            {huddle.barrier_category !== "None" && <div><b>Barrier — {huddle.barrier_category}:</b> {huddle.barrier_detail}</div>}
            <div><b>Safety:</b> {huddle.safety_status} · <b>Referral:</b> {huddle.referral_status}</div>
            <div><b>Coach next move:</b> {huddle.coach_next_move}</div>
            {huddle.team_decision_required && <div><b>Team decision:</b> {huddle.team_decision}</div>}
            <div style={{ color: "var(--muted)", fontSize: 11.5 }}>Recorded by {huddle.author_name}</div>
          </div>
        </details>) : <div style={{ borderTop: "1px solid var(--border)", padding: "16px", color: "var(--muted)", fontSize: 12.5 }}>No structured huddles recorded yet.</div>}
      </section>

      {notes.length > 0 && <details style={{ ...box, padding: "11px 16px" }}><summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>Earlier free-text MDT updates ({notes.length})</summary><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{notes.map((note) => <div key={note.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12.5 }}><b>{note.author ?? "—"}</b>{note.client_name ? ` · ${note.client_name}` : ""}{note.escalated ? ` · → ${disciplineLabel(note.to_role ?? "")}` : ""}<div style={{ marginTop: 2 }}>{note.body}</div></div>)}</div></details>}
    </div>
  );
}
