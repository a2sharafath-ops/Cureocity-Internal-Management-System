export type TriageTask = {
  id: string;
  status: string;
  dueDate: string | null;
  assigneeId: string | null;
};

export type TaskTriage = {
  open: number;
  overdue: number;
  blocked: number;
  unassigned: number;
  mine: number;
};

export function taskTriage(tasks: TriageTask[], today: string, staffId: string | null): TaskTriage {
  const open = tasks.filter((task) => task.status !== "done");
  return {
    open: open.length,
    overdue: open.filter((task) => Boolean(task.dueDate && task.dueDate < today)).length,
    blocked: open.filter((task) => task.status === "blocked").length,
    unassigned: open.filter((task) => !task.assigneeId).length,
    mine: staffId ? open.filter((task) => task.assigneeId === staffId).length : 0,
  };
}
