"use client";

import { useEffect, useRef, useState } from "react";
import { startScribe, scribeSupported, clockText, appendPhrase, type ScribeSession, type ScribeStatus } from "@/lib/scribe";

/**
 * Ambient scribe — transcribes the consultation while the clinician talks, so
 * the summary is written from what was actually said rather than from memory
 * afterwards.
 *
 * The panel is the same whichever engine is behind it. Today that engine is the
 * browser's own recogniser; when a paid service is bought, `lib/scribe.ts`
 * gains a second implementation and nothing here changes.
 */
export default function AmbientScribe({
  clientName, transcript, onTranscript, onSeconds, onInsert, disabled,
}: {
  clientName: string;
  transcript: string;
  onTranscript: (t: string) => void;
  /** Session length in seconds, lifted so it can be saved with the consult. */
  onSeconds: (s: number) => void;
  /** Push the transcript into the consultation summary. */
  onInsert: (t: string) => void;
  /** A completed consultation is read-only. */
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<ScribeStatus>("idle");
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sec, setSec] = useState(0);
  const [provider, setProvider] = useState("Browser dictation");
  const session = useRef<ScribeSession | null>(null);
  const tRef = useRef(transcript);
  tRef.current = transcript;

  useEffect(() => { setStatus(scribeSupported() ? "idle" : "unsupported"); }, []);

  // The clock runs only while listening, so the duration is consulting time.
  useEffect(() => {
    if (status !== "listening") return;
    const t = setInterval(() => setSec((s) => { const n = s + 1; onSeconds(n); return n; }), 1000);
    return () => clearInterval(t);
  }, [status, onSeconds]);

  // Never leave the microphone open behind a closed console.
  useEffect(() => () => { session.current?.stop(); }, []);

  const begin = () => {
    setErr(null);
    const s = startScribe({
      onFinal: (text) => { onTranscript(appendPhrase(tRef.current, text)); setInterim(""); },
      onInterim: setInterim,
      onError: (m) => { setErr(m); setStatus("error"); },
      onEnd: () => setInterim(""),
    });
    if (!s) { setStatus("unsupported"); return; }
    session.current = s;
    setProvider(s.provider);
    setStatus("listening");
  };
  const pause = () => { session.current?.pause(); setStatus("paused"); setInterim(""); };
  const resume = () => { session.current?.resume(); setStatus("listening"); };
  const stop = () => { session.current?.stop(); session.current = null; setStatus("idle"); setInterim(""); };

  const live = status === "listening";
  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const btn: React.CSSProperties = { border: "1px solid var(--border)", background: "#fff", borderRadius: 999, padding: "5px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };
  const primary: React.CSSProperties = { ...btn, background: "var(--ink)", color: "#fff", border: "none" };

  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <div style={{ ...box, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", flexWrap: "wrap" }}>
        <span style={{
          width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
          background: live ? "var(--red)" : status === "paused" ? "var(--amber-text)" : "var(--border)",
          boxShadow: live ? "0 0 0 4px rgba(220,38,38,.15)" : undefined,
        }} />
        <b style={{ fontSize: 13 }}>Ambient scribe</b>
        <span style={{ fontSize: 12, color: "var(--muted)", flex: 1, minWidth: 140 }}>
          {status === "unsupported" ? "This browser can't transcribe — use Chrome or Edge, or type notes below."
            : live ? `Listening to ${clientName}…`
            : status === "paused" ? "Paused"
            : status === "error" ? "Stopped"
            : words ? `${words} words captured` : "Off — start to capture this session"}
        </span>

        <b style={{ fontVariantNumeric: "tabular-nums", fontSize: 13.5, color: sec > 0 ? "var(--ink)" : "var(--muted)" }}>{clockText(sec)}</b>

        {status === "unsupported" ? null : disabled ? null : live ? (
          <>
            <button type="button" onClick={pause} style={btn}>Pause</button>
            <button type="button" onClick={stop} style={primary}>■ Stop</button>
          </>
        ) : status === "paused" ? (
          <>
            <button type="button" onClick={resume} style={primary}>▶ Resume</button>
            <button type="button" onClick={stop} style={btn}>■ Stop</button>
          </>
        ) : (
          <button type="button" onClick={begin} style={{ ...primary, background: "var(--red)" }}>● Start recording</button>
        )}
      </div>

      {err && <div style={{ padding: "0 16px 10px", fontSize: 12, color: "var(--red-text)" }}>{err}</div>}

      {(live || status === "paused" || transcript.trim()) && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".3px" }}>Transcript · {provider}</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => onInsert(transcript)} disabled={!transcript.trim()}
              title="Append the transcript to the consultation summary" style={{ ...btn, borderRadius: 8, opacity: transcript.trim() ? 1 : 0.5 }}>
              Add to summary
            </button>
            <button type="button" onClick={() => { onTranscript(""); setInterim(""); }} disabled={!transcript.trim()}
              style={{ ...btn, borderRadius: 8, opacity: transcript.trim() ? 1 : 0.5 }}>Clear</button>
          </div>
          {/* Editable: recognition is imperfect and a clinician correcting a drug
              name in place is faster than re-dictating it. */}
          <textarea value={transcript + (interim ? (transcript ? " " : "") + interim : "")}
            onChange={(e) => onTranscript(e.target.value)} rows={5} readOnly={disabled}
            placeholder="Speech appears here as it's recognised. You can edit it."
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.5 }} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
            Kept with this consultation as you go. It is a working note, not the clinical record — the summary is.
          </div>
        </div>
      )}
    </div>
  );
}
