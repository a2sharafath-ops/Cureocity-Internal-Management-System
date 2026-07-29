"use client";

// The loading "notch" for navigations that DON'T cross a route segment — tab
// switches, calendar week arrows, filter links — which never trigger
// loading.tsx. It shows the moment an internal link is clicked and hides as soon
// as the URL settles, so every click gets the same visible cue.

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteProgress() {
  const [active, setActive] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL changed → navigation finished. Hide.
  useEffect(() => {
    setActive(false);
    if (timer.current) clearTimeout(timer.current);
  }, [pathname, search]);

  // Show the moment an internal link is clicked.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      // No navigation if it's the exact same URL.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 8000); // safety net
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); if (timer.current) clearTimeout(timer.current); };
  }, []);

  if (!active) return null;
  return (
    <div style={{ position: "fixed", top: 12, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 9999, pointerEvents: "none" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(20,20,25,0.92)", color: "#fff", borderRadius: 999, padding: "10px 20px", boxShadow: "0 10px 34px rgba(20,20,25,0.32)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", fontSize: 13.5, fontWeight: 600, letterSpacing: "0.1px", animation: "cure-notch-in 0.32s cubic-bezier(0.22,1,0.36,1)" }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "cure-spin 0.7s linear infinite" }} />
        Loading…
      </div>
    </div>
  );
}
