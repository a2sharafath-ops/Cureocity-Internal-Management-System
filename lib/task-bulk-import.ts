export type ImportedTaskLine = {
  title: string;
  assigneeName: string | null;
  dueDate: string | null;
  priority: "High" | "Medium" | "Low";
};

const PRIORITIES = new Set(["High", "Medium", "Low"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse one task per line: Title | Assignee (optional) | YYYY-MM-DD (optional) | Priority (optional). */
export function parseTaskImport(input: string): { tasks: ImportedTaskLine[]; error?: string } {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { tasks: [], error: "Add at least one task." };
  if (lines.length > 100) return { tasks: [], error: "Import up to 100 tasks at a time." };
  const tasks: ImportedTaskLine[] = [];
  for (const [index, line] of lines.entries()) {
    const [rawTitle, rawAssignee = "", rawDate = "", rawPriority = "Medium", ...extra] = line.split("|").map((part) => part.trim());
    if (extra.length || !rawTitle || rawTitle.length > 300) return { tasks: [], error: `Line ${index + 1} needs a task title of up to 300 characters.` };
    if (rawDate && !ISO_DATE.test(rawDate)) return { tasks: [], error: `Line ${index + 1} needs a YYYY-MM-DD due date.` };
    if (!PRIORITIES.has(rawPriority)) return { tasks: [], error: `Line ${index + 1} priority must be High, Medium or Low.` };
    tasks.push({ title: rawTitle, assigneeName: rawAssignee || null, dueDate: rawDate || null, priority: rawPriority as ImportedTaskLine["priority"] });
  }
  return { tasks };
}
