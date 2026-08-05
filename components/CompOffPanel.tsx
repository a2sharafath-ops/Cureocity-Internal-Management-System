"use client";

import { useState, useTransition } from "react";
import { grantCompOff, cancelCompOff, takeCompOff } from "@/lib/actions";
import { compOffBalance, type CompOff } from "@/lib/roster";

type Staff = { id: string; name: string; role: string };

/**
 * Compensatory off — a ledger, not a number.
 *
 * A restricted holiday can only be granted to part of the team; whoever covers
 * it is owed the day back. Showing a bare balance invites "why do I have two?"
 * with no answer, so every credit shows what earned it and when it lapses.
 */
export default function CompOffPanel({
  staff, credits, canEdit, today,
}: {
  staff: Staff[];
  credits: (CompOff & { staff_name?: string | null; granted_by?: string | null; used_on?: string | null })[];
  canEdit: boolean;
  today: string;
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showUsed, setShowUsed] = useState(false);

  const run = (fn: () => Promise<{ error?: string; ok?: boolean } | void>, done: string) => {
    setErr(null); setMsg(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) setErr(r.error); else setMsg(done);
    });
  };

  const byStaff = new Map<string, typeof credits>();
  for (const c of credits) {
    const list = byStaff.get(c.staff_id) ?? [];
    list.push(c); byStaff.set(c.staff_id, list);
  }

  const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "7px 9px", fontSize: 13, background: "#fff" };

  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {canEdit && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Grant a compensatory off</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            For someone who worked a holiday or week-off, or whose restricted leave could not be granted.
            The credit is valid for <b>90 days</b> from the day worked.
          </div>
          <form
            action={(fd) => run(() => grantCompOff(fd), "Comp-off granted.")}
            style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 2fr auto", gap: 8, alignItems: "end" }}
          >
            <label style={{ display: "grid", gap: 3 }}>
              <span style={lbl}>Staff</span>
              <select name="staff_id" required style={inp} defaultValue="">
                <option value="" disabled>Select…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 3 }}>
              <span style={lbl}>Day worked</span>
              <input type="date" name="earned_on" required defaultValue={today} style={inp} />
            </label>
            <label style={{ display: "grid", gap: 3 }}>
              <span style={lbl}>Reason</span>
              <input name="reason" required placeholder="Worked 15 Aug · restricted leave not granted" style={inp} />
            </label>
            <button type="submit" disabled={busy} style={{ background: "var(--ink)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
              {busy ? "…" : "Grant"}
            </button>
          </form>
          {err && <div style={{ color: "var(--red-text)", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
          {msg && <div style={{ color: "var(--green-text)", fontSize: 12.5, marginTop: 8 }}>{msg}</div>}
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Comp-off balances</div>
          <span style={{ flex: 1 }} />
          <label style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
            <input type="checkbox" checked={showUsed} onChange={(e) => setShowUsed(e.target.checked)} />
            Show used &amp; expired
          </label>
        </div>

        {byStaff.size === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No compensatory offs recorded yet.</div>
        ) : (
          Array.from(byStaff.entries()).map(([sid, list]) => {
            const person = staff.find((s) => s.id === sid);
            const bal = compOffBalance(list, today);
            const visible = showUsed ? list : list.filter((c) => c.status === "available" && c.expires_on >= today);
            if (!visible.length && !showUsed) return null;
            return (
              <div key={sid} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                  <b style={{ fontSize: 13 }}>{person?.name ?? list[0]?.staff_name ?? sid}</b>
                  <span style={{ background: bal.available ? "var(--green-bg)" : "var(--neutral-bg)", color: bal.available ? "var(--green-text)" : "var(--muted)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>
                    {bal.available} available
                  </span>
                  {bal.expiringSoon > 0 && (
                    <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>
                      {bal.expiringSoon} expiring within 14 days
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  {canEdit && bal.available > 0 && (
                    <form action={(fd) => run(() => takeCompOff(fd), "Comp-off booked.")} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="staff_id" value={sid} />
                      <input type="date" name="date" required defaultValue={today} style={{ ...inp, padding: "4px 7px", fontSize: 12 }} />
                      <button type="submit" disabled={busy} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Take a day
                      </button>
                    </form>
                  )}
                </div>

                {visible.map((c) => {
                  const lapsed = c.status === "available" && c.expires_on < today;
                  const tone = c.status === "used" ? "var(--muted)"
                    : c.status === "cancelled" ? "var(--muted)"
                    : lapsed || c.status === "expired" ? "var(--red-text)" : "var(--ink)";
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, padding: "3px 0", color: tone }}>
                      <span style={{ minWidth: 96, color: "var(--muted)" }}>{fmt(c.earned_on)}</span>
                      <span style={{ fontWeight: 500 }}>{c.reason}</span>
                      <span style={{ flex: 1 }} />
                      {c.status === "used"
                        ? <span>used {c.used_on ? fmt(c.used_on) : ""}</span>
                        : c.status === "cancelled"
                          ? <span>cancelled</span>
                          : <span>{lapsed || c.status === "expired" ? "expired" : `expires ${fmt(c.expires_on)}`}</span>}
                      {canEdit && c.status === "available" && !lapsed && (
                        <form action={cancelCompOff}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" title="Granted in error" style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
                            Cancel
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 11, color: "var(--muted)", fontWeight: 600 };
