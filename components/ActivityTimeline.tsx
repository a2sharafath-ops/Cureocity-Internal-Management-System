// One activity stream for a person, newest first.
//
// Server component: the events are already fetched and merged by the page, so
// there's nothing to hydrate. Grouped into Today / Yesterday / This week /
// month names because an undifferentiated list of forty rows is as hard to
// scan as six separate tables.

import Link from "next/link";
import {
  groupByPeriod, ago, KIND_ICON, KIND_LABEL,
  type TimelineEvent,
} from "@/lib/timeline";

const time = (at: string) =>
  new Date(at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export default function ActivityTimeline({
  events, today, emptyLabel = "Nothing recorded yet.", max,
}: {
  events: TimelineEvent[];
  today: string;
  emptyLabel?: string;
  /** cap the list; the page decides whether to offer "show all" */
  max?: number;
}) {
  const shown = max ? events.slice(0, max) : events;
  const groups = groupByPeriod(shown, today);

  if (!shown.length) {
    return <div style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0" }}>{emptyLabel}</div>;
  }

  return (
    <div>
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
            {g.label}
          </div>
          {g.events.map((e, i) => {
            const body = (
              <div style={{
                display: "flex", gap: 10, padding: "8px 0",
                borderTop: i ? "1px solid var(--border)" : "none",
                // Scheduled-but-not-yet-happened reads muted, so a future
                // appointment doesn't look like something that was done.
                opacity: e.pending ? 0.62 : 1,
              }}>
                <span style={{ fontSize: 15, lineHeight: "20px", width: 20, textAlign: "center", flexShrink: 0 }}>
                  {KIND_ICON[e.kind]}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
                  {e.detail && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{e.detail}</div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {KIND_LABEL[e.kind]} · {time(e.at)} · {ago(e.at)}
                    {e.by ? ` · ${e.by}` : ""}
                  </div>
                </div>
              </div>
            );
            return e.href
              ? <Link key={`${e.at}-${i}`} href={e.href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{body}</Link>
              : <div key={`${e.at}-${i}`}>{body}</div>;
          })}
        </div>
      ))}
      {max && events.length > max && (
        <div style={{ color: "var(--muted)", fontSize: 11.5 }}>
          Showing the most recent {max} of {events.length}.
        </div>
      )}
    </div>
  );
}
