"use client";

// Medical reports for a client — blood panels, thyroid profiles, ECGs, scans.
//
// Mirrors the InBody flow so there's one habit to learn: upload the PDF, then
// either read it here (📄 Extract, no AI needed) or ask the AI (✨ Generate).
// The summary is editable and saved against the file itself.

import { useState } from "react";
import FileUploadForm from "@/components/FileUploadForm";
import SummaryEditor from "@/components/SummaryEditor";
import { extractReportSummary, aiReportSummary, saveReportSummary } from "@/lib/actions";
import type { AiState } from "@/lib/ai";

export type ReportRow = {
  id: string; name: string | null; kind: string | null;
  report_label: string | null; report_date: string | null;
  summary: string | null; created_at: string; url?: string | null;
};

const IST = "Asia/Kolkata";
const d = (iso: string | null) =>
  iso ? new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso)
    .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: iso.length <= 10 ? "UTC" : IST })
    : null;

export default function MedicalReports({ clientId, reports }: { clientId: string; reports: ReportRow[] }) {
  // Which report's summary is open. Defaults to the newest, since that's the one
  // a clinician is almost always looking at during a consultation.
  const [openId, setOpenId] = useState<string | null>(reports[0]?.id ?? null);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" };

  // The editor passes client_id; these reports are keyed by file, so wrap the
  // actions to carry file_id instead.
  const withFile = (fn: (p: AiState, f: FormData) => Promise<AiState>, fileId: string) =>
    async (prev: AiState, fd: FormData): Promise<AiState> => {
      fd.set("file_id", fileId);
      return fn(prev, fd);
    };

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontWeight: 700 }}>Medical reports</div>
        {reports.length > 0 && <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 9px", fontSize: 11, fontWeight: 700 }}>{reports.length}</span>}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Blood panels, thyroid, ECG, scans — upload the PDF, then read it or summarise it.
      </div>

      {reports.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>No reports uploaded yet.</div>
      )}

      <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
        {reports.map((r) => {
          const open = openId === r.id;
          return (
            <div key={r.id} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: open ? "var(--bg)" : "#fff" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.report_label || r.name || "Report"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                    {d(r.report_date) ?? d(r.created_at)}
                    {r.summary ? " · summarised" : " · no summary yet"}
                  </div>
                </div>
                {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand-text)", textDecoration: "none", flexShrink: 0 }}>Open PDF →</a>}
                <button type="button" onClick={() => setOpenId(open ? null : r.id)}
                  style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                  {open ? "Hide" : "Summary"}
                </button>
              </div>
              {open && (
                <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)" }}>
                  <SummaryEditor
                    label={r.report_label || r.name || "Report summary"}
                    clientId={clientId}
                    initial={r.summary ?? ""}
                    extractAction={withFile(extractReportSummary, r.id)}
                    extractLabel="Extract from PDF"
                    aiAction={withFile(aiReportSummary, r.id)}
                    saveAction={async (_c, text) => saveReportSummary(r.id, text)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Add a report</div>
        <FileUploadForm variant="staff" clientId={clientId} kind="medical_report" label="Upload report" accept="application/pdf,image/*" />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>PDF preferred — a PDF can be read automatically; a photo can only be filed.</div>
      </div>
    </div>
  );
}
