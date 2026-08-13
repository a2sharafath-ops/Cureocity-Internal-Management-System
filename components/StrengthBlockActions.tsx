"use client";

import { useState, useTransition } from "react";
import { rescheduleStrengthBlock } from "@/lib/actions";

type Trainer = { id: string; name: string };

export default function StrengthBlockActions({ clientId, trainers, defaultTrainerId, canReschedule }: {
  clientId: string; trainers: Trainer[]; defaultTrainerId: string; canReschedule: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!canReschedule) return null;

  const submit = (formData: FormData) => startTransition(async () => {
    setError(null);
    const result = await rescheduleStrengthBlock(formData);
    if (result.ok) setOpen(false);
    else setError(result.error ?? "Could not reschedule the strength block.");
  });

  return <div style={{ margin: "0 0 12px" }}>
    <button type="button" onClick={() => setOpen((value) => !value)} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Reschedule entire block</button>
    {open && <form action={submit} style={{ marginTop: 8, display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 9 }}>
      <input type="hidden" name="client_id" value={clientId} />
      <label style={{ fontSize: 12 }}>New start <input required type="date" name="start_date" style={{ marginLeft: 4 }} /></label>
      <label style={{ fontSize: 12 }}>Time <select name="hour" defaultValue="9" style={{ marginLeft: 4 }}>{Array.from({ length: 9 }, (_, index) => index + 9).map((hour) => <option key={hour} value={hour}>{`${hour > 12 ? hour - 12 : hour}:00 ${hour < 12 ? "AM" : "PM"}`}</option>)}</select></label>
      <label style={{ fontSize: 12 }}>Trainer <select name="trainer_id" defaultValue={defaultTrainerId} style={{ marginLeft: 4 }}>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></label>
      <button disabled={pending} style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 6, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>{pending ? "Saving…" : "Save all 12"}</button>
      {error && <span style={{ color: "var(--red-text)", fontSize: 12 }}>{error}</span>}
    </form>}
  </div>;
}
