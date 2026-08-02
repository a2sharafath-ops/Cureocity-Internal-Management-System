// Two-list snapshot of everything a client's packages still need — open work
// vs. what's coming up — each line deep-linking to where it gets handled.
import Link from "next/link";
import type { StatusItem } from "@/lib/package-status";
import { nudgeClinician, nudgeRole } from "@/lib/actions";
import SubmitButton from "@/components/SubmitButton";
import { splitStatus } from "@/components/StatusLabel";

const TONE: Record<string, { dot: string }> = {
  warn: { dot: "var(--red-text)" },
  info: { dot: "var(--blue-text)" },
  neutral: { dot: "#94a3b8" },
};

const firstName = (n: string) => n.split(" ")[0];

const chaseBtn: React.CSSProperties = { border: "none", background: "var(--brand-fill)", color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
// Owner action: the viewer owns this deliverable, so give them a button to go do
// it (not a "Remind" — you don't remind yourself).
const ownerBtn: React.CSSProperties = { ...chaseBtn, textDecoration: "none", display: "inline-block" };

// `canChase` = the viewer is an overseer (Super Admin / Admin / Manager). For
// them, ops items (bookings, blood chase, invoices) that no single clinician
// owns turn into a "Chase <role>" nudge instead of a dead-end link.
function List({ items, empty, clientId, canChase, viewerStaffId }: { items: StatusItem[]; empty: string; clientId: string; canChase: boolean; viewerStaffId?: string | null }) {
  if (!items.length) return <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{empty}</div>;
  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 12.5, textDecoration: "none" };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => {
        const { main, badge } = splitStatus(it.label);
        const body = (
          <>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[it.tone].dot, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: "var(--ink)" }}>{main}</span>
              {badge && <span style={{ marginLeft: 6, background: badge.bg, color: badge.color, borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700, textTransform: "capitalize", whiteSpace: "nowrap" }}>{badge.text}</span>}
              {it.detail ? <span style={{ color: "var(--muted)" }}> · {it.detail}</span> : null}
            </span>
          </>
        );
        const border = i ? { borderTop: "1px solid var(--border)" } : {};
        // Clinician-owed item → nudge the responsible clinician (all staff).
        // But never "Remind" the owner about their own work — when the viewer IS
        // the owner they fall through to the plain deep-link and act on it.
        if (it.ownerStaffId && it.ownerStaffId !== viewerStaffId) {
          return (
            <div key={i} style={{ ...rowStyle, ...border }}>
              {body}
              <form action={nudgeClinician}>
                <input type="hidden" name="client_id" value={clientId} />
                <input type="hidden" name="staff_id" value={it.ownerStaffId} />
                <input type="hidden" name="label" value={it.label} />
                <SubmitButton persist pendingLabel="Sending…" doneLabel={`✓ ${it.ownerName ? firstName(it.ownerName) : "Owner"} notified`} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: "var(--brand-text)", whiteSpace: "nowrap" }}>
                  Remind{it.ownerName ? ` ${firstName(it.ownerName)}` : ""}
                </SubmitButton>
              </form>
            </div>
          );
        }
        // Viewer owns this deliverable → a filled action button to go do it.
        if (it.ownerStaffId && it.ownerStaffId === viewerStaffId && it.href) {
          return (
            <div key={i} style={{ ...rowStyle, ...border }}>
              {body}
              <Link href={it.href} style={ownerBtn}>{it.ownerCta ?? "Open"} →</Link>
            </div>
          );
        }
        // Overseer + an ops item with a responsible role → chase that role.
        if (canChase && it.chaseRoles?.length) {
          return (
            <div key={i} style={{ ...rowStyle, ...border }}>
              {body}
              <form action={nudgeRole} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input type="hidden" name="roles" value={it.chaseRoles.join(",")} />
                <input type="hidden" name="label" value={it.label} />
                <input type="hidden" name="client_id" value={clientId} />
                {it.href && <input type="hidden" name="href" value={it.href} />}
                <SubmitButton persist pendingLabel="Sending…" doneLabel={`✓ ${it.chaseWho ?? "Team"} notified`} style={chaseBtn}>
                  Chase {it.chaseWho ?? "team"}
                </SubmitButton>
              </form>
              {it.href && <Link href={it.href} style={{ color: "var(--brand-text)", fontSize: 11.5, whiteSpace: "nowrap", textDecoration: "none" }}>Open →</Link>}
            </div>
          );
        }
        // Everyone else → the plain deep-link.
        const tail = it.href ? <span style={{ color: "var(--brand-text)", fontSize: 11.5, whiteSpace: "nowrap" }}>Open →</span> : null;
        return it.href
          ? <Link key={i} href={it.href} style={{ ...rowStyle, ...border }}>{body}{tail}</Link>
          : <div key={i} style={{ ...rowStyle, ...border }}>{body}{tail}</div>;
      })}
    </div>
  );
}

export default function PackageStatusPanel({ openNow, upcoming, clientId, canChase = false, viewerStaffId }: { openNow: StatusItem[]; upcoming: StatusItem[]; clientId: string; canChase?: boolean; viewerStaffId?: string | null }) {
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Open now</div>
          {openNow.length > 0 && <span style={{ background: "var(--red-bg)", color: "var(--red-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11.5, fontWeight: 700 }}>{openNow.length}</span>}
        </div>
        <List items={openNow} empty="Nothing open — all caught up." clientId={clientId} canChase={canChase} viewerStaffId={viewerStaffId} />
      </div>
      <div style={box}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Upcoming</div>
          {upcoming.length > 0 && <span style={{ background: "var(--blue-bg)", color: "var(--blue-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11.5, fontWeight: 700 }}>{upcoming.length}</span>}
        </div>
        <List items={upcoming} empty="Nothing scheduled ahead." clientId={clientId} canChase={canChase} viewerStaffId={viewerStaffId} />
      </div>
    </div>
  );
}
