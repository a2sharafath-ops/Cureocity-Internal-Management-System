"use client";

import { useState, useTransition } from "react";
import { setRosterShift, copyRosterWeek } from "@/lib/actions";
import { weekDates, addDays, visibleDays, shiftHours, isOverridden, type Shift, type RosterRow } from "@/lib/roster";

type Staff = { id: string; name: string; role: string };

const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// The order and grouping of the HR roster workbook: each discipline is its own
// block with its own Date / Day header, because that is how the roster is read
// — "who is on the desk this week", not "what is everyone doing on Tuesday".
// Management sits last; the sheet doesn't roster them at all, so the block only
// appears if somebody has been given a shift.
const ROLE_GROUPS: { label: string; roles: string[] }[] = [
  { label: "Dietitians",      roles: ["Dietitian"] },
  { label: "Doctors",         roles: ["Doctor"] },
  { label: "Front Desk",      roles: ["Front Desk"] },
  { label: "Health Coach",    roles: ["Health Coach"] },
  { label: "Trainers",        roles: ["Fitness Trainer"] },
  { label: "Psychologists",   roles: ["Psychologist"] },
  { label: "Management & HR", roles: ["Administrator", "Super Admin", "Manager", "HR"] },
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
  const week = weekDates(weekOf);
  const days = visibleDays(week, rows);
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
      fd.set("from_week", week[0]); fd.set("to_week", addDays(week[0], 7));
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

  const dLabel = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <a href={`/hr?tab=roster&week=${addDays(week[0], -7)}`} style={navBtn}>← Previous</a>
        <b style={{ fontSize: 13 }}>
          {new Date(`${week[0]}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
          {" – "}
          {new Date(`${days[days.length - 1]}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
        </b>
        <a href={`/hr?tab=roster&week=${addDays(week[0], 7)}`} style={navBtn}>Next →</a>
        <span style={{ flex: 1 }} />
        {canEdit && (
          <button type="button" onClick={copyForward} disabled={busy} style={{ ...navBtn, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Working…" : "Copy this week → next"}
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--brand-text)", marginBottom: 10 }}>{msg}</div>}

      {grouped.map((g) => (
        <div key={g.label} style={{ marginBottom: 22, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, border: "1px solid var(--border)" }}>
            <thead>
              {/* Date row — the discipline names itself in the corner cell, as
                  it does in the workbook. */}
              <tr>
                <th style={{ ...cornerTh }}>{g.label}</th>
                <th style={{ ...labelTh }}>Date</th>
                {days.map((d) => (
                  <th key={d} style={{ ...dateTh, background: d === today ? "var(--brand-tint)" : "var(--bg)" }}>
                    {dLabel(d)}
                  </th>
                ))}
              </tr>
              <tr>
                <th style={{ ...cornerTh, borderTop: "none" }} />
                <th style={{ ...labelTh }}>Day</th>
                {days.map((d, i) => (
                  <th key={d} style={{ ...dayTh, background: d === today ? "var(--brand-tint)" : "var(--bg)" }}>
                    {DOW[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.people.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...nameTd }} colSpan={2}>{s.name}</td>
                  {days.map((d) => {
                    const r = cell.get(`${s.id}|${d}`);
                    const sh = r ? shiftMap.get(r.shift) : undefined;
                    const hours = shiftHours(r, shiftMap);
                    return (
                      <td key={d} style={{
                        border: "1px solid var(--border)", padding: 3, textAlign: "center", verticalAlign: "middle",
                        background: d === today ? "var(--brand-tint)" : sh?.color ? `${sh.color}12` : "#fff",
                      }}>
                        {canEdit ? (
                          <>
                            <select
                              value={r?.shift ?? ""}
                              onChange={(e) => assign(s.id, d, e.target.value)}
                              disabled={busy}
                              aria-label={`${s.name} · ${DOW[days.indexOf(d)]}`}
                              style={{
                                width: "100%", border: "none", background: "transparent", cursor: "pointer",
                                fontSize: 11.5, fontWeight: 700, textAlign: "center",
                                color: sh?.color ?? "var(--muted)", appearance: "none", padding: "2px 0",
                              }}
                            >
                              <option value="">—</option>
                              {shifts.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                            </select>
                            {hours && (
                              <div style={{ fontSize: 10.5, color: isOverridden(r, shiftMap) ? "var(--amber-text)" : "var(--muted)", lineHeight: 1.25 }}>
                                {hours}
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: sh?.color ?? "var(--muted)", padding: "4px 2px", lineHeight: 1.3 }}>
                            {sh?.working ? hours : (sh?.name ?? "—")}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
        {shifts.map((s) => (
          <span key={s.code} style={{ fontSize: 11.5, color: "var(--muted)" }}>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: s.color ?? "#ccc", marginRight: 5 }} />
            {s.name}
            {s.start_time ? ` · ${s.start_time.slice(0, 5)}–${(s.end_time ?? "").slice(0, 5)}` : ""}
            {s.start_time2 ? `, ${s.start_time2.slice(0, 5)}–${(s.end_time2 ?? "").slice(0, 5)}` : ""}
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
const cornerTh: React.CSSProperties = {
  border: "1px solid var(--border)", background: "var(--bg)", padding: "7px 10px",
  textAlign: "left", fontSize: 12.5, fontWeight: 800, minWidth: 110, whiteSpace: "nowrap",
};
const labelTh: React.CSSProperties = {
  border: "1px solid var(--border)", background: "var(--bg)", padding: "6px 8px",
  textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--muted)", width: 52,
};
const dateTh: React.CSSProperties = {
  border: "1px solid var(--border)", padding: "6px 4px",
  fontSize: 11.5, fontWeight: 700, color: "var(--ink)", minWidth: 96,
};
const dayTh: React.CSSProperties = {
  border: "1px solid var(--border)", padding: "5px 4px",
  fontSize: 11, fontWeight: 600, color: "var(--muted)",
};
const nameTd: React.CSSProperties = {
  border: "1px solid var(--border)", padding: "7px 10px",
  fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
};
