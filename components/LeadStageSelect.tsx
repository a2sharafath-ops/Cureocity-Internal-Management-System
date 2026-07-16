"use client";

import { updateLeadStage } from "@/lib/actions";

const STAGES = [
  "1-New Lead", "2-Discovery", "3-Product Match", "4-Visit/Trial", "5-Close", "6-Nurture", "LOST",
];

export default function LeadStageSelect({ id, stage }: { id: string; stage: string }) {
  return (
    <form action={updateLeadStage}>
      <input type="hidden" name="id" value={id} />
      <select
        name="stage"
        defaultValue={stage}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        style={{
          border: "1px solid var(--border)", borderRadius: 8, padding: "5px 8px",
          fontSize: 12, background: "#fff", cursor: "pointer",
        }}
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </form>
  );
}
