// The turnaround clocks for one BluePrint client, plus the hold control.
//
// Server component: the clocks are computed once at render from timestamps, so
// there's no ticking countdown. On a 24-hour commitment a live second-by-second
// timer would be false precision and a needless client bundle — the page
// already refreshes on Realtime changes.

import { toggleBlueprintHold } from "@/lib/actions";
import {
  blueprintSla, formatLeft, SLA_TONE, KIND_LABEL,
  type ConsultInput,
} from "@/lib/blueprint-sla";

const chip = (label: string, tone: { bg: string; color: string }) => (
  <span style={{ background: tone.bg, color: tone.color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
    {label}
  </span>
);

const when = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
};

export default function BlueprintSla({
  clientId, consults, consolidatedAt, approvedAt, holdSince, holdMs, canHold,
}: {
  clientId: string;
  consults: ConsultInput[];
  consolidatedAt: string | null;
  approvedAt: string | null;
  holdSince: string | null;
  holdMs: number;
  canHold: boolean;
}) {
  const r = blueprintSla(
    { consults, consolidatedAt, approvedAt, hold: { holdSince, holdMs } },
  );

  const row = (label: string, c: (typeof r.signoffs)[number]["clock"], detail: string) => {
    const tone = SLA_TONE[c.status];
    return (
      <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", fontSize: 12.5 }}>
        <span style={{ minWidth: 92, fontWeight: 600 }}>{label}</span>
        {chip(tone.label, tone)}
        <span style={{ color: "var(--muted)", fontSize: 11.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.status === "waiting" ? detail : `${formatLeft(c.msLeft)} · due ${when(c.dueAt)}`}
        </span>
      </div>
    );
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px", marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)" }}>
          Turnaround
        </span>
        {r.onHold && chip("On hold — client", { bg: "var(--purple-bg)", color: "var(--purple-text)" })}
        <span style={{ flex: 1 }} />
        {canHold && (
          <form action={toggleBlueprintHold}>
            <input type="hidden" name="client_id" value={clientId} />
            {!holdSince && <input type="hidden" name="note" value="Waiting on client" />}
            <button
              type="submit"
              style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: "var(--ink)" }}
            >
              {holdSince ? "Resume clock" : "Hold — waiting on client"}
            </button>
          </form>
        )}
      </div>

      {r.signoffs.map(({ kind, clock }) =>
        row(KIND_LABEL[kind], clock, "appointment not completed"))}

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 2 }}>
        {row("Delivery", r.consolidated,
          r.lastCompletedAt ? "—" : "waiting on all three appointments")}
      </div>

      <div style={{ color: "var(--muted)", fontSize: 10.5, marginTop: 4 }}>
        Sign-off 24h from each appointment · delivery 48h from the last of the three
        {holdMs > 0 && ` · ${Math.round(holdMs / 3_600_000)}h held`}
      </div>
    </div>
  );
}
