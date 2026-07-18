"use client";

export type AuditExportRow = { when: string; user: string; role: string; action: string; detail: string };

export default function ExportAuditButton({ rows }: { rows: AuditExportRow[] }) {
  const download = () => {
    const header = ["When", "User", "Role", "Action", "Detail"];
    const esc = (c: string) => `"${String(c ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows.map((r) => [r.when, r.user, r.role, r.action, r.detail])]
      .map((line) => line.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" onClick={download} style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
      Export log
    </button>
  );
}
