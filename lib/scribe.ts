// The ambient scribe's transcript source.
//
// Two providers, one interface. Today the console uses the browser's own speech
// recognition, which costs nothing and works in Chrome and Edge. When a paid
// STT service is bought, it becomes a second implementation of `ScribeSession`
// and the console does not change — only `startScribe` picks differently.
//
// Deliberately NOT a stub: a disabled button that says "soon" teaches the team
// the feature doesn't work and they stop looking at it. Dictation that works
// now, and gets better when the service is bought, keeps the habit alive.

export type ScribeStatus = "unsupported" | "idle" | "listening" | "paused" | "error";

export type ScribeSession = {
  /** Human name of whatever is producing the text, shown in the panel. */
  provider: string;
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

export type ScribeHandlers = {
  /** Text confirmed by the recogniser — append it to the transcript. */
  onFinal: (text: string) => void;
  /** The in-flight phrase, replaced on every update. Never appended. */
  onInterim: (text: string) => void;
  onError: (message: string) => void;
  /** Fired when the recogniser stops on its own (silence, tab change). */
  onEnd: () => void;
};

// The Web Speech API is not in TypeScript's DOM lib. Only the parts used here.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function recogniser(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
  return Ctor ? new Ctor() : null;
}

/** Whether this browser can transcribe at all. Safari and Firefox cannot. */
export function scribeSupported(): boolean {
  return recogniser() !== null;
}

/**
 * Begin transcribing. Returns null when the browser has no recogniser, which
 * the caller shows as an explicit "not supported here" state rather than a
 * button that silently does nothing.
 *
 * `lang` defaults to Indian English, which markedly improves accuracy on names
 * and on the code-switching that happens in a Kochi consulting room.
 */
export function startScribe(h: ScribeHandlers, lang = "en-IN"): ScribeSession | null {
  const rec = recogniser();
  if (!rec) return null;

  rec.lang = lang;
  rec.continuous = true;      // a consultation is not one utterance
  rec.interimResults = true;  // show words as they land, so it looks alive

  let stopped = false;
  let paused = false;

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r[0]?.transcript ?? "";
      if (r.isFinal) h.onFinal(text.trim());
      else interim += text;
    }
    h.onInterim(interim.trim());
  };

  rec.onerror = (e) => {
    const code = e?.error ?? "unknown";
    // "no-speech" and "aborted" are normal in a quiet room or on a manual stop;
    // surfacing them as errors would cry wolf.
    if (code === "no-speech" || code === "aborted") return;
    h.onError(
      code === "not-allowed" ? "Microphone blocked — allow access in the browser and start again."
      : code === "network" ? "Speech service unreachable — check the connection."
      : `Recogniser error: ${code}`,
    );
  };

  // The browser stops on its own after a pause. Restart unless the clinician
  // asked it to stop, so a thinking silence doesn't end the session.
  rec.onend = () => {
    if (stopped || paused) { h.onEnd(); return; }
    try { rec.start(); } catch { h.onEnd(); }
  };

  try { rec.start(); } catch { return null; }

  return {
    provider: "Browser dictation",
    stop: () => { stopped = true; try { rec.stop(); } catch { /* already stopped */ } },
    pause: () => { paused = true; try { rec.stop(); } catch { /* already stopped */ } },
    resume: () => { paused = false; try { rec.start(); } catch { /* already running */ } },
  };
}

/** mm:ss for the session clock. */
export function clockText(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

/**
 * Fold a newly-confirmed phrase into the running transcript.
 *
 * Kept separate (and tested) because the naive `a + " " + b` produces doubled
 * spaces and orphaned punctuation, and a transcript that reads badly is one
 * nobody pastes into a summary.
 */
export function appendPhrase(transcript: string, phrase: string): string {
  const p = phrase.trim();
  if (!p) return transcript;
  const t = transcript.replace(/\s+$/, "");
  if (!t) return p[0].toUpperCase() + p.slice(1);
  // Start a new sentence after terminal punctuation; otherwise continue the one
  // in progress.
  const ends = /[.!?]$/.test(t);
  const joined = ends ? `${t} ${p[0].toUpperCase() + p.slice(1)}` : `${t} ${p}`;
  return joined;
}
