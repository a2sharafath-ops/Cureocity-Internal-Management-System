// Two-list snapshot of everything a client's packages still need — open work
// vs. what's coming up — each line deep-linking to where it gets handled.
import Link from "next/link";
import type { StatusItem } from "@/lib/package-status";

const TONE: Record<string, { dot: string }> = {
  warn: { dot: "var(--red-text)" },
  info: { dot: "var(--blue-text)" },
  neutral: { dot: "#94a3b8" },
};

function List({ items, empty }: { items: StatusItem[]; empty: string }) {
  if (!items.length) return <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{empty}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => {
        const body = (
          <>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[it.tone].dot, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: "var(--ink)" }}>{it.label}</span>
              {it.detail ? <span style={{ color: "var(--muted)" }}> · {it.detail}</span> : null}
            </span>
            {it.href ? <span style={{ color: "var(--brand-text)", fontSize: 11.5, whiteSpace: "nowrap" }}>Open →</span> : null}
          </>
        );
        const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 12.5, borderTop: i ? "1px solid var(--border)" : "none", textDecoration: "none" };
        return it.href
          ? <Link key={i} href={it.href} style={rowStyle}>{body}</Link>
          : <div key={i} style={rowStyle}>{body}</div>;
      })}
    </div>
  );
}

export default function PackageStatusPanel({ openNow, upcoming }: { openNow: StatusItem[]; upcoming: StatusItem[] }) {
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Open now</div>
          {openNow.length > 0 && <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11.5, fontWeight: 700 }}>{openNow.length}</span>}
        </div>
        <List items={openNow} empty="Nothing open — all caught up." />
      </div>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Upcoming</div>
          {upcoming.length > 0 && <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11.5, fontWeight: 700 }}>{upcoming.length}</span>}
        </div>
        <List items={upcoming} empty="Nothing scheduled ahead." />
      </div>
    </div>
  );
}
