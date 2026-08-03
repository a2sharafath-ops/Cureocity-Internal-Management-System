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
  // Which report is being worked on — newest by default, since that's almost
  // always the one a clinician has just uploaded or is discussing.
  const [openId, setOpenId] = useState<string | null>(reports[0]?.id ?? null);
  const selected = reports.find((r) => r.id === openId) ?? reports[0] ?? null;

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

      {reports.length > 0 && (
        <>
          {/* Pick which report you're working on. One click, no hunting. */}
          {reports.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {reports.map((r) => {
                const on = r.id === selected?.id;
                return (
                  <button key={r.id} type="button" onClick={() => setOpenId(r.id)}
                    style={{ border: "1px solid var(--border)", background: on ? "var(--brand-fill)" : "#fff", color: on ? "#fff" : "var(--ink)",
                             borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {r.report_label || r.name || "Report"}
                    <span style={{ opacity: 0.75, marginLeft: 6, fontWeight: 500 }}>{d(r.report_date) ?? d(r.created_at)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{selected.report_label || selected.name || "Report"}</div>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{d(selected.report_date) ?? d(selected.created_at)}{selected.summary ? "" : " · no summary yet"}</span>
                <span style={{ flex: 1 }} />
                {selected.url && <a href={selected.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand-text)", textDecoration: "none" }}>Open PDF →</a>}
              </div>
              <SummaryEditor
                key={selected.id}
                label="Report summary"
                clientId={clientId}
                initial={selected.summary ?? ""}
                extractAction={withFile(extractReportSummary, selected.id)}
                extractLabel="Extract from PDF"
                aiAction={withFile(aiReportSummary, selected.id)}
                saveAction={async (_c, text) => saveReportSummary(selected.id, text)}
              />
            </div>
          )}
        </>
      )}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Add a report</div>
        <FileUploadForm variant="staff" clientId={clientId} kind="medical_report" label="Upload report" accept="application/pdf,image/*" />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>PDF preferred — a PDF can be read automatically; a photo can only be filed.</div>
      </div>
    </div>
  );
}
