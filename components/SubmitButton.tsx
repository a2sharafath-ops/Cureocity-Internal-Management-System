"use client";

// A submit button with built-in feedback: shows "Saving…" while the form action
// runs, then flashes "✓ Saved" so the user knows it worked. Drop-in replacement
// for <button type="submit"> inside any <form action={serverAction}>.

import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";

export default function SubmitButton({
  children, style, pendingLabel = "Saving…", doneLabel = "✓ Saved", doneMs = 1600, title,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  pendingLabel?: string;
  doneLabel?: string;
  doneMs?: number;
  title?: string;
}) {
  const { pending } = useFormStatus();
  const [done, setDone] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setDone(true);
      const t = setTimeout(() => setDone(false), doneMs);
      wasPending.current = pending;
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending, doneMs]);

  return (
    <button type="submit" disabled={pending} title={title}
      style={{ ...style, opacity: pending ? 0.7 : 1, cursor: pending ? "default" : (style?.cursor ?? "pointer") }}>
      {pending ? pendingLabel : done ? doneLabel : children}
    </button>
  );
}
