"use client";

import { usePathname } from "next/navigation";
import { metaForPath } from "@/lib/nav-meta";

export default function HeaderTitle() {
  const pathname = usePathname();
  const meta = metaForPath(pathname);
  if (!meta) return <span style={{ color: "var(--muted)", fontSize: 13 }}>Cureocity — Internal Management System</span>;
  return <b style={{ fontSize: 14 }}>{meta.title}</b>;
}
