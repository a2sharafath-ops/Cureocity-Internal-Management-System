"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Day picker for the meal-monitoring log — step back through previous days'
// records. Preserves any other query params (role / tab). No future days.
export default function MealDayNav({ date, today }: { date: string; today: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const href = (d: string) => {
    const p = new URLSearchParams(sp.toString());
    if (d === today) p.delete("d"); else p.set("d", d);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const shift = (n: number) => {
    const dt = new Date(`${date}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const isToday = date === today;
  const canNext = shift(1) <= today;

  const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)" };
  const dim: React.CSSProperties = { ...btn, color: "var(--muted)", cursor: "default", opacity: 0.5 };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      <Link href={href(shift(-1))} style={btn}>← Prev</Link>
      {!isToday && <Link href={href(today)} style={btn}>Today</Link>}
      {canNext ? <Link href={href(shift(1))} style={btn}>Next →</Link> : <span style={dim}>Next →</span>}
      <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4 }}>{label}{isToday ? " · Today" : ""}</span>
      {!isToday && <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>History · read-only</span>}
    </div>
  );
}
