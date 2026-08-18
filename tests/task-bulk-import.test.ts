import { describe, expect, it } from "vitest";
import { parseTaskImport } from "@/lib/task-bulk-import";

describe("task bulk import parsing", () => {
  it("accepts title, optional owner/date and priority", () => {
    expect(parseTaskImport("Confirm venue | Asha | 2026-08-22 | High\nPrint badges").tasks).toEqual([
      { title: "Confirm venue", assigneeName: "Asha", dueDate: "2026-08-22", priority: "High" },
      { title: "Print badges", assigneeName: null, dueDate: null, priority: "Medium" },
    ]);
  });

  it("rejects malformed due dates and priorities", () => {
    expect(parseTaskImport("Confirm venue | Asha | 22-08-2026").error).toContain("YYYY-MM-DD");
    expect(parseTaskImport("Confirm venue | Asha | 2026-08-22 | Urgent").error).toContain("High, Medium or Low");
  });
});
