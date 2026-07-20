"use client";

import { useState } from "react";
import { reviewMeal, nudgeMeal, answerMealDoubt } from "@/lib/actions";
import type { MealLog } from "@/lib/meals";

export default function MealStaffCell({
  clientId, meal, label, icon, log,
}: { clientId: string; meal: string; label: string; icon: string; log: MealLog | null }) {
  const [rev, setRev] = useState(false);
  const [ans, setAns] = useState(false);
  const logged = !!log?.description;

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: logged ? "var(--surface)" : "#fff" }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{icon} {label}</div>

      {logged ? (
        <>
          <div style={{ fontSize: 13, marginTop: 4 }}>{log!.description}</div>
          {log?.review ? (
            <div style={{ fontSize: 12, color: "var(--green-text)", marginTop: 4 }}>✔ {log.review}</div>
          ) : null}
          <button type="button" onClick={() => setRev((o) => !o)} style={{ marginTop: 6, border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>
            {rev ? "Cancel" : log?.review ? "Edit review" : "Add review"}
          </button>
          {rev && (
            <form action={reviewMeal} onSubmit={() => setTimeout(() => setRev(false), 50)} style={{ marginTop: 6 }}>
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="meal" value={meal} />
              <textarea name="review" rows={2} defaultValue={log?.review ?? ""} placeholder="Feedback / suggestion / motivation…" style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, padding: "5px 7px" }} />
              <button type="submit" style={{ marginTop: 4, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>Save review</button>
            </form>
          )}
        </>
      ) : (
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Not logged yet. </span>
          {log?.nudged ? (
            <span style={{ background: "var(--amber-bg)", color: "var(--amber-text)", borderRadius: 999, padding: "1px 8px", fontSize: 11 }}>Reminder sent</span>
          ) : (
            <form action={nudgeMeal} style={{ display: "inline" }}>
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="meal" value={meal} />
              <button type="submit" style={{ border: "none", background: "var(--ink)", color: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>📩 Send reminder</button>
            </form>
          )}
        </div>
      )}

      {log?.doubt && (
        <div style={{ marginTop: 8, background: "var(--amber-bg)", borderRadius: 8, padding: "6px 8px" }}>
          <div style={{ fontSize: 12, color: "var(--amber-text)" }}>❓ {log.doubt}</div>
          {log.doubt_answer ? (
            <div style={{ fontSize: 12, color: "var(--green-text)", marginTop: 3 }}>↳ {log.doubt_answer}</div>
          ) : ans ? (
            <form action={answerMealDoubt} onSubmit={() => setTimeout(() => setAns(false), 50)} style={{ marginTop: 4 }}>
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="meal" value={meal} />
              <textarea name="answer" rows={2} placeholder="Your answer…" style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, padding: "5px 7px" }} />
              <button type="submit" style={{ marginTop: 4, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer" }}>Send answer</button>
            </form>
          ) : (
            <button type="button" onClick={() => setAns(true)} style={{ marginTop: 4, border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>💬 Answer</button>
          )}
        </div>
      )}
    </div>
  );
}
