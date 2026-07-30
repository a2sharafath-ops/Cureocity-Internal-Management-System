"use client";

// A submit button with built-in feedback: shows "Saving…" while the form action
// runs, then flashes "✓ Saved" so the user knows it worked. Drop-in replacement
// for <button type="submit"> inside any <form action={serverAction}>.

import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";

export default function SubmitButton({
  children, style, pendingLabel = "Saving…", doneLabel = "✓ Saved", doneMs = 1600, title, persist = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  pendingLabel?: string;
  doneLabel?: string;
  doneMs?: number;
  title?: string;
  /** Keep the "done" state (and disable the button) instead of reverting after
   *  doneMs. Use for one-shot actions like a nudge, where a lasting "✓ sent"
   *  is clearer than a flash the user can miss. */
  persist?: boolean;
}) {
  const { pending } = useFormStatus();
  const [done, setDone] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setDone(true);
      wasPending.current = pending;
      if (persist) return;              // leave it showing the done label
      const t = setTimeout(() => setDone(false), doneMs);
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending, doneMs, persist]);

  return (
    <button type="submit" disabled={pending || (persist && done)} title={title}
      style={{ ...style, opacity: pending ? 0.7 : 1, cursor: pending || (persist && done) ? "default" : (style?.cursor ?? "pointer") }}>
      {pending ? pendingLabel : done ? doneLabel : children}
    </button>
  );
}
