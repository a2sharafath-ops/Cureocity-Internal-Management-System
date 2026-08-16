import { redirect } from "next/navigation";
import WorkboardItemCard from "@/components/WorkboardItemCard";
import { getProfile } from "@/lib/auth";
import { IST } from "@/lib/datetime";
import { logServerError } from "@/lib/runtime-errors";
import { createClient } from "@/lib/supabase/server";
import {
  canViewWorkboard,
  missingBaselineKeys,
  orderedWorkboardWorkstreams,
  WORKBOARD_STATUSES,
  type WorkboardHistoryItem,
  type WorkboardItem,
  type WorkboardStatus,
} from "@/lib/workboard";

export const dynamic = "force-dynamic";

const statusTone: Record<WorkboardStatus, React.CSSProperties> = {
  Pending: { background: "var(--amber-bg)", color: "var(--amber-text)" },
  "In progress": { background: "var(--blue-bg)", color: "var(--blue-text)" },
  Done: { background: "var(--green-bg)", color: "var(--green-text)" },
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: IST,
  });
}

export default async function WorkboardPage() {
  const me = await getProfile();
  if (!me || !canViewWorkboard(me.role)) redirect("/dashboard");

  const supabase = await createClient();
  const itemResult = await supabase
    .from("workboard_items")
    .select("id, item_key, workstream, title, state_note, status, next_action, sort_order, updated_at, updated_by_name")
    .order("sort_order", { ascending: true });

  if (itemResult.error) {
    logServerError(itemResult.error, { source: "workboard", operation: "load_items" });
    return (
      <div style={{ maxWidth: 900 }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Workboard</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Super Admin sprint visibility and next actions.</p>
        <div style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 12, padding: "15px 17px", lineHeight: 1.5, fontSize: 13 }}>
          <b>Workboard setup is required in this environment.</b>
          <div style={{ marginTop: 4 }}>Apply the forward-only migration <code>supabase/0184_super_admin_workboard.sql</code> through the approved environment rollout before using this page.</div>
        </div>
      </div>
    );
  }

  const items = (itemResult.data ?? []) as WorkboardItem[];
  const historyResult = await supabase
    .from("workboard_item_history")
    .select("id, item_id, from_status, to_status, changed_by_name, changed_at, workboard_items(title)")
    .order("changed_at", { ascending: false })
    .limit(20);
  if (historyResult.error) logServerError(historyResult.error, { source: "workboard", operation: "load_history" });
  const history = (historyResult.data ?? []) as unknown as WorkboardHistoryItem[];
  const missing = missingBaselineKeys(items);
  const workstreams = orderedWorkboardWorkstreams(items);
  const counts = Object.fromEntries(WORKBOARD_STATUSES.map((status) => [status, items.filter((item) => item.status === status).length])) as Record<WorkboardStatus, number>;

  return (
    <div style={{ maxWidth: 1320 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: "1 1 320px" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Workboard</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0, lineHeight: 1.45 }}>One Super Admin view of current workstreams, delivery state, and the next safe action. Status changes are recorded automatically.</p>
        </div>
        <span style={{ borderRadius: 999, background: "var(--neutral-bg)", color: "var(--muted)", padding: "6px 10px", fontSize: 11.5, fontWeight: 700 }}>Super Admin only</span>
      </div>

      <section aria-label="Workboard status summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 9, marginBottom: 16 }}>
        {WORKBOARD_STATUSES.map((status) => (
          <div key={status} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow)", padding: "12px 14px" }}>
            <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>{status}</div>
            <div style={{ ...statusTone[status], display: "inline-flex", minWidth: 32, justifyContent: "center", borderRadius: 999, padding: "3px 9px", marginTop: 6, fontSize: 17, fontWeight: 800 }}>{counts[status]}</div>
          </div>
        ))}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow)", padding: "12px 14px" }}>
          <div style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700 }}>Total tracked</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 5 }}>{items.length}</div>
        </div>
      </section>

      <section aria-label="Workboard workstream summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 210px), 1fr))", gap: 9, marginBottom: 16 }}>
        {workstreams.map((workstream) => {
          const streamItems = items.filter((item) => item.workstream === workstream);
          const open = streamItems.filter((item) => item.status !== "Done").length;
          return (
            <div key={workstream} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 13px" }}>
              <div style={{ fontSize: 12, fontWeight: 750 }}>{workstream}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>{streamItems.length} item{streamItems.length === 1 ? "" : "s"} · {open} open</div>
            </div>
          );
        })}
      </section>

      {missing.length > 0 && (
        <div role="alert" style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 10, padding: "10px 12px", fontSize: 12, marginBottom: 14 }}>
          <b>The current sprint baseline is incomplete.</b> {missing.length} expected item{missing.length === 1 ? " is" : "s are"} missing. Review the migration state before relying on the totals.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))", gap: 14, alignItems: "start" }}>
        {WORKBOARD_STATUSES.map((status) => {
          const column = items.filter((item) => item.status === status);
          return (
            <section key={status} aria-labelledby={`workboard-${status.replace(/\s/g, "-").toLowerCase()}`} style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <h2 id={`workboard-${status.replace(/\s/g, "-").toLowerCase()}`} style={{ fontSize: 15, margin: 0 }}>{status}</h2>
                <span style={{ ...statusTone[status], borderRadius: 999, padding: "2px 8px", fontSize: 10.5, fontWeight: 750 }}>{column.length}</span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {column.map((item) => <WorkboardItemCard key={item.id} item={item} />)}
                {column.length === 0 && <div style={{ border: "1px dashed var(--border)", borderRadius: 12, padding: 18, color: "var(--muted)", fontSize: 12, textAlign: "center" }}>No items in this column.</div>}
              </div>
            </section>
          );
        })}
      </div>

      <section style={{ marginTop: 22, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 13, boxShadow: "var(--shadow)", overflow: "hidden" }}>
        <div style={{ padding: "13px 15px" }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Recent status history</h2>
          <p style={{ color: "var(--muted)", fontSize: 11.5, margin: "3px 0 0" }}>Append-only changes, newest first. The same event is also written to the Audit Log.</p>
        </div>
        {historyResult.error ? (
          <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--red-text)", fontSize: 12 }}>History could not be loaded. Item status data remains available above.</div>
        ) : history.length > 0 ? history.map((entry) => (
          <div key={entry.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 15px", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", fontSize: 12 }}>
            <b style={{ flex: "1 1 260px" }}>{entry.workboard_items?.title ?? "Work item"}</b>
            <span style={{ color: "var(--muted)" }}>{entry.from_status ? `${entry.from_status} → ` : "Baseline · "}<span style={{ color: statusTone[entry.to_status].color, fontWeight: 750 }}>{entry.to_status}</span></span>
            <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{entry.changed_by_name ?? "Migration"} · {when(entry.changed_at)}</span>
          </div>
        )) : (
          <div style={{ borderTop: "1px solid var(--border)", padding: 15, color: "var(--muted)", fontSize: 12 }}>No status changes recorded yet.</div>
        )}
      </section>
    </div>
  );
}
