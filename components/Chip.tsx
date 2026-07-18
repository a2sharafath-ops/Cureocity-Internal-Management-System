// Design-system pill / badge (pure, server-safe).
// Replaces the ad-hoc `chip(bg, color, text)` helpers repeated across pages.
import type React from "react";

export default function Chip({
  bg, color, children, style,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span style={{ background: bg, color, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600, ...style }}>
      {children}
    </span>
  );
}
