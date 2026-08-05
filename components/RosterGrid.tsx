"use client";

import { useState, useTransition } from "react";
import { setRosterShift, copyRosterWeek } from "@/lib/actions";
import { weekDates, addDays, shiftHours, isOverridden, type Shift, type RosterRow } from "@/lib/roster";

type Staff = { id: string; name: string; role: string };

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Disciplines in the order a clinic thinks about the floor: who greets, who
// coaches, who trains, then the clinical roles.
const ROLE_GROUPS: { label: string; roles: string[] }[] = [
  { label: "Front office",  roles: ["Front Desk", "Administrator", "Manager", "HR"] },
  { label: "Health coach",  roles: ["Health Coach"] },
  { label: "Trainers",      roles: ["Fitness Trainer"] },
  { label: "Dietitians",    roles: ["Dietitian"] },
  { label: "Doctors",       roles: ["Doctor"] },
  { label: "Psychologists", roles: ["Psychologist"] },
];

export default function RosterGrid({
  staff, shifts, rows, weekOf, canEdit,
}: {
  staff: Staff[];
  shifts: Shift[];
  rows: RosterRow[];
  weekOf: string;
  canEdit: boolean;
}) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const days = weekDates(weekOf);
  const shiftMap = new Map(shifts.map((s) => [s.code, s]));
  const cell = new Map(rows.map((r) => [`${r.staff_id}|${r.date}`, r]));
  const today = new Date().toISOString().slice(0, 10);

  const assign = (staffId: string, date: string, code: string) => {
    start(async () => {
      const fd = new FormData();
      fd.set("staff_id", staffId); fd.set("date", date); fd.set("shift", code);
      await setRosterShift(fd);
    });
  };

  const copyForward = () => {
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("from_week", days[0]); fd.set("to_week", addDays(days[0], 7));
      const r = await copyRosterWeek(fd);
      setMsg(r?.error ?? `Copied ${r?.copied ?? 0} shifts into next week.`);
    });
  };

  const grouped = ROLE_GROUPS
    .map((g) => ({ ...g, people: staff.filter((s) => g.roles.includes(s.role)) }))
    .filter((g) => g.people.length > 0);
  // Anyone whose role isn't in a group still needs a line — a roster that
  // silently omits someone is worse than no roster.
  const placed = new Set(grouped.flatMap((g) => g.people.map((p) => p.id)));
  const others = staff.filter((s) => !placed.has(s.id));
  if (others.length) grouped.push({ label: "Other", roles: [], people: others });

  const th: React.CSSProperties = { padding: "6px 8px", fontSize: 11, color: "var(--muted)", fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: ".3px" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <a href={`/hr?tab=roster&week=${addDays(days[0], -7)}`} style={navBtn}>← Previous</a>
        <b style={{ fontSize: 13 }}>
          {new Date(`${days[0]}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
          {" – "}
          {new Date(`${days[6]}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
        </b>
        <a href={`/hr?tab=roster&week=${addDays(days[0], 7)}`} style={navBtn}>Next →</a>
        <span style={{ flex: 1 }} />
        {canEdit && (
          <button type="button" onClick={copyForward} disabled={busy} style={{ ...navBtn, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Working…" : "Copy this week → next"}
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--brand-text)", marginBottom: 8 }}>{msg}</div>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", minWidth: 150 }}>Staff</th>
              {days.map((d, i) => (
                <th key={d} style={{ ...th, background: d === today ? "var(--brand-tint)" : undefined }}>
                  {DOW[i]}<br />
                  <span style={{ fontWeight: 500, color: "var(--muted)" }}>{d.slice(8)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <>
                <tr key={g.label}>
                  <td colSpan={8} style={{ padding: "10px 8px 4px", fontSize: 10.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>
                    {g.label}
                  </td>
                </tr>
                {g.people.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "7px 8px", fontSize: 13, fontWeight: 600 }}>
                      {s.name}
                      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{s.role}</div>
                    </td>
                    {days.map((d) => {
                      const r = cell.get(`${s.id}|${d}`);
                      const sh = r ? shiftMap.get(r.shift) : undefined;
                      return (
                        <td key={d} style={{ padding: 3, textAlign: "center", background: d === today ? "var(--brand-tint)" : undefined }}>
                          {canEdit ? (
                            <select
                              value={r?.shift ?? ""}
                              onChange={(e) => assign(s.id, d, e.target.value)}
                              disabled={busy}
                              style={{
                                width: "100%", border: "1px solid var(--border)", borderRadius: 6,
                                padding: "4px 2px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                                background: sh?.color ? `${sh.color}1a` : "#fff",
                                color: sh?.color ?? "var(--muted)",
                              }}
                            >
                              <option value="">—</option>
                              {shifts.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                            </select>
                          ) : (
                            <span style={{
                              display: "inline-block", borderRadius: 6, padding: "3px 7px", fontSize: 11.5, fontWeight: 700,
                              background: sh?.color ? `${sh.color}1a` : "transparent", color: sh?.color ?? "var(--muted)",
                            }}>
                              {sh ? sh.name : "—"}
                            </span>
                          )}
                          {r && sh?.working && (
                            <div style={{ fontSize: 10, color: isOverridden(r, shiftMap) ? "var(--amber-text)" : "var(--muted)", marginTop: 1 }}>
                              {shiftHours(r, shiftMap)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {shifts.map((s) => (
          <span key={s.code} style={{ fontSize: 11.5, color: "var(--muted)" }}>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: s.color ?? "#ccc", marginRight: 5 }} />
            {s.name}{s.start_time ? ` · ${s.start_time.slice(0, 5)}–${(s.end_time ?? "").slice(0, 5)}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: "1px solid var(--border)", background: "#fff", borderRadius: 8,
  padding: "5px 11px", fontSize: 12, fontWeight: 600, color: "var(--ink)", textDecoration: "none",
};
