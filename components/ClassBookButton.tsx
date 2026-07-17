"use client";

import { bookClassSelf, cancelClassSelf } from "@/lib/actions";

export default function ClassBookButton({ classId, booked, full }: { classId: string; booked: boolean; full: boolean }) {
  if (booked) {
    return (
      <form action={cancelClassSelf}>
        <input type="hidden" name="class_id" value={classId} />
        <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "var(--red)" }}>Cancel</button>
      </form>
    );
  }
  if (full) return <span style={{ color: "var(--muted)", fontSize: 12 }}>Full</span>;
  return (
    <form action={bookClassSelf}>
      <input type="hidden" name="class_id" value={classId} />
      <button type="submit" style={{ background: "var(--teal)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Book</button>
    </form>
  );
}
