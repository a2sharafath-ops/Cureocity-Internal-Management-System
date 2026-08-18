"use client";

import { organizeExistingTasksIntoProjects } from "@/lib/actions";

export default function TaskProjectTools({ hasProjects }: { hasProjects: boolean }) {
  if (hasProjects) return null;
  return <form action={organizeExistingTasksIntoProjects}><button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 10, padding: "9px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Organize current tasks</button></form>;
}
