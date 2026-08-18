import { notFound } from "next/navigation";
import TasksPageContent from "../TasksPageContent";

const VIEWS = new Set(["all", "open", "attention", "completed", "overdue", "blocked", "unassigned"]);

export default async function TaskListPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!VIEWS.has(view)) notFound();
  return <TasksPageContent />;
}
