"use client";

import { usePathname } from "next/navigation";
import { metaForPath } from "@/lib/nav-meta";

export default function HeaderTitle() {
  const pathname = usePathname();
  const meta = metaForPath(pathname);
  if (!meta) return <span style={{ color: "var(--muted)", fontSize: 13 }}>Cureocity — Internal Management System</span>;
  return (
    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
      <b style={{ fontSize: 14 }}>{meta.title}</b>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>{meta.sub}</span>
    </span>
  );
}
