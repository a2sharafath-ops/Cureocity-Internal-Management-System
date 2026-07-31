"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { punchByBadge, punchByPin } from "@/lib/actions";

type Punch = { ok?: boolean; name?: string; action?: "in" | "out" | "already"; at?: string; hours?: number; error?: string };

const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
const fmtHrs = (h?: number) => { if (!h) return ""; const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${m % 60}m`; };

export default function KioskAttendance({ staff, logo }: { staff: { id: string; name: string }[]; logo: string }) {
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [sid, setSid] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scanner = useRef<any>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  // Load the QR scanner library once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Html5Qrcode) { setReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js";
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);

  const flash = (r: Punch) => {
    if (r.error) { setMsg({ text: r.error, tone: "err" }); }
    else if (r.action === "in") setMsg({ text: `Welcome, ${r.name}! Checked in at ${fmtTime(r.at)}.`, tone: "ok" });
    else if (r.action === "out") setMsg({ text: `Bye, ${r.name}! Checked out at ${fmtTime(r.at)} · worked ${fmtHrs(r.hours)}.`, tone: "ok" });
    else setMsg({ text: `${r.name}, you're already checked out for today.`, tone: "ok" });
    setTimeout(() => setMsg(null), 6000);
  };

  const onDecode = async (code: string) => {
    const now = Date.now();
    if (code === lastScan.current.code && now - lastScan.current.at < 4000) return; // debounce repeats
    lastScan.current = { code, at: now };
    flash(await punchByBadge(code));
  };

  const startScan = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const H = (window as any).Html5Qrcode;
    if (!H) { setMsg({ text: "Scanner still loading — try again in a moment, or use Identify manually.", tone: "err" }); return; }
    try {
      scanner.current = new H("kiosk-reader");
      await scanner.current.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, onDecode, () => {});
      setScanning(true);
    } catch {
      setMsg({ text: "Couldn't open the camera. Allow camera access, or use Identify manually.", tone: "err" });
    }
  };
  const stopScan = async () => {
    try { await scanner.current?.stop(); scanner.current?.clear(); } catch { /* noop */ }
    setScanning(false);
  };
  useEffect(() => () => { try { scanner.current?.stop(); } catch { /* noop */ } }, []);

  const submitPin = async () => {
    if (!sid || pin.length < 4) { setMsg({ text: "Pick your name and enter your 4-digit PIN.", tone: "err" }); return; }
    setBusy(true);
    const r = await punchByPin(sid, pin);
    setBusy(false);
    flash(r);
    if (r.ok) { setPin(""); setSid(""); setManual(false); }
  };

  const card: React.CSSProperties = { width: "100%", maxWidth: 460, background: "#fff", borderRadius: 18, boxShadow: "0 10px 40px rgba(0,0,0,.12)", padding: "36px 30px", textAlign: "center" };
  const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 16, background: "#fff", boxSizing: "border-box" };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg, #f3f4f6)" }}>
      <div style={card}>
        <img src={logo} alt="Cureocity" style={{ height: 44, margin: "0 auto 6px", display: "block", maxWidth: 120, objectFit: "contain" }} />
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>Welcome to Cureocity</div>
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Mark your attendance</div>

        {msg && (
          <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: msg.tone === "ok" ? "var(--green-bg)" : "var(--red-bg)", color: msg.tone === "ok" ? "var(--green-text)" : "var(--red-text)" }}>{msg.text}</div>
        )}

        {!manual && (
          <>
            <div id="kiosk-reader" style={{ width: "100%", maxWidth: 300, margin: "0 auto 14px", borderRadius: 12, overflow: "hidden", background: "#000", minHeight: scanning ? 220 : 0 }} />
            {!scanning ? (
              <button type="button" onClick={startScan} disabled={!ready} style={{ width: "100%", background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 12, padding: "16px", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: ready ? 1 : 0.6 }}>{ready ? "📷 Scan your badge" : "Loading scanner…"}</button>
            ) : (
              <button type="button" onClick={stopScan} style={{ width: "100%", background: "#fff", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>■ Stop camera</button>
            )}
            <div style={{ marginTop: 16 }}>
              <button type="button" onClick={() => { stopScan(); setManual(true); setMsg(null); }} style={{ border: "none", background: "transparent", color: "var(--brand-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Identify manually</button>
            </div>
          </>
        )}

        {manual && (
          <div style={{ display: "grid", gap: 12, textAlign: "left" }}>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Your name
              <select value={sid} onChange={(e) => setSid(e.target.value)} style={{ ...inp, marginTop: 4 }}>
                <option value="">— select —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>PIN
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="4-digit PIN" style={{ ...inp, marginTop: 4, letterSpacing: 4, textAlign: "center" }} />
            </label>
            <button type="button" onClick={submitPin} disabled={busy} style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "Mark attendance"}</button>
            <button type="button" onClick={() => { setManual(false); setMsg(null); }} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>← Back to scan</button>
          </div>
        )}
      </div>
      <Link href="/hr?tab=attendance" style={{ marginTop: 16, color: "var(--muted)", fontSize: 12, textDecoration: "none" }}>Exit kiosk →</Link>
    </main>
  );
}
