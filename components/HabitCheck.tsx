"use client";

import { toggleHabitSelf } from "@/lib/actions";

// Portal check-off toggle for one habit (today).
export default function HabitCheck({ habitId, doneToday }: { habitId: string; doneToday: boolean }) {
  return (
    <form action={toggleHabitSelf}>
      <input type="hidden" name="habit_id" value={habitId} />
      <input type="hidden" name="done" value={doneToday ? "false" : "true"} />
      <button type="submit" title={doneToday ? "Undo today" : "Mark done today"}
        style={{
          width: 30, height: 30, borderRadius: 8, cursor: "pointer",
          border: doneToday ? "none" : "1px solid var(--border)",
          background: doneToday ? "var(--brand-fill)" : "#fff",
          color: doneToday ? "#fff" : "var(--muted)", fontSize: 15, lineHeight: 1,
        }}>
        {doneToday ? "✓" : ""}
      </button>
    </form>
  );
}
