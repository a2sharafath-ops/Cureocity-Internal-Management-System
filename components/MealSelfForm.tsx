"use client";

import { saveMealSelf } from "@/lib/actions";
import type { MealLog } from "@/lib/meals";

export default function MealSelfForm({
  meal, label, icon, log,
}: { meal: string; label: string; icon: string; log: MealLog | null }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{icon} {label}</div>
      <form action={saveMealSelf}>
        <input type="hidden" name="meal" value={meal} />
        <input
          name="description"
          defaultValue={log?.description ?? ""}
          placeholder="What did you have?"
          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, padding: "7px 9px" }}
        />
        <input
          name="doubt"
          defaultValue={log?.doubt ?? ""}
          placeholder="Any question for your dietitian? (optional)"
          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, padding: "7px 9px", marginTop: 6 }}
        />
        <button type="submit" style={{ marginTop: 8, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Save
        </button>
      </form>
      {log?.review && <div style={{ fontSize: 12, color: "#166534", marginTop: 8 }}>✔ Dietitian: {log.review}</div>}
      {log?.doubt_answer && <div style={{ fontSize: 12, color: "var(--teal-dark)", marginTop: 4 }}>↳ Answer: {log.doubt_answer}</div>}
    </div>
  );
}
