"use client";

import { useState } from "react";
import { rescheduleSession, markSessionComplete } from "@/lib/actions";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];

type Trainer = { id: string; name: string };

export default function SessionActions({
  id, clientId, date, hour, trainerId, status, trainers,
}: {
  id: string; clientId: string; date: string; hour: number; trainerId: string;
  status: string; trainers: Trainer[];
}) {
  const [open, setOpen] = useState(false);

  if (status !== "scheduled") return <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 9px", fontSize: 12, cursor: "pointer" }}
        >
          Reschedule
        </button>
        <form action={markSessionComplete}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="client_id" value={clientId} />
          <button
            type="submit"
            style={{ border: "none", background: "var(--green)", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}
          >
            ✓ Mark done
          </button>
        </form>
      </div>

      {open && (
        <form
          action={rescheduleSession}
          onSubmit={() => setTimeout(() => setOpen(false), 50)}
          style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", background: "#f8fbfa", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
        >
          <input type="hidden" name="id" value={id} />
          <input
            type="date" name="date" defaultValue={date}
            style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", fontSize: 12 }}
          />
          <select name="hour" defaultValue={hour} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
            {HOURS.map((h) => {
              const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12;
              return <option key={h} value={h}>{`${hr}:00 ${am ? "AM" : "PM"}`}</option>;
            })}
          </select>
          <select name="trainer_id" defaultValue={trainerId} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", fontSize: 12 }}>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button type="submit" style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
            Save
          </button>
        </form>
      )}
    </div>
  );
}
