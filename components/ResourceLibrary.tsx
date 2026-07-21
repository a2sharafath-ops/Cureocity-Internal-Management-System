"use client";

import { useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadResourceFile, deleteResourceFile, type UploadState } from "@/lib/actions";

export type ResourceRow = {
  id: string;
  role: string;
  folder: string;
  name: string;
  url: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = { doctor: "Doctor", diet: "Dietitian", trainer: "Trainer", coach: "Health Coach", all: "Shared" };
const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();
const icon = (n: string) => {
  const e = ext(n);
  if (e === "pdf") return "📕";
  if (e === "xlsx" || e === "xls" || e === "csv") return "📊";
  if (e === "docx" || e === "doc") return "📄";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(e)) return "🖼️";
  return "📎";
};

function SubmitBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} style={{ background: "var(--brand-fill)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>{pending ? "Uploading…" : "Upload"}</button>;
}

export default function ResourceLibrary({ role, roleLabel, files }: { role: string; roleLabel: string; files: ResourceRow[] }) {
  const [state, formAction] = useFormState<UploadState, FormData>(uploadResourceFile, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state.ok]);

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const inp: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", fontSize: 13, background: "#fff" , height: 36, boxSizing: "border-box" };

  // group by folder
  const folders = new Map<string, ResourceRow[]>();
  for (const f of files) { (folders.get(f.folder) ?? folders.set(f.folder, []).get(f.folder)!).push(f); }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
        Resources for the <b>{roleLabel}</b> workspace. Shared files appear in every workspace.
      </div>

      <form ref={ref} action={formAction} style={{ ...box, padding: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select name="role" defaultValue={role} style={inp}>
          <option value={role}>{ROLE_LABEL[role] ?? role} only</option>
          <option value="all">Shared (all workspaces)</option>
        </select>
        <input name="folder" placeholder="Folder (e.g. Templates)" style={{ ...inp, width: 190 }} />
        <input type="file" name="file" required style={{ fontSize: 13 }} />
        <SubmitBtn />
        {state.error && <span style={{ color: "var(--red-text)", fontSize: 12 }}>{state.error}</span>}
        {state.ok && <span style={{ color: "var(--green-text)", fontSize: 12 }}>{state.ok}</span>}
      </form>

      {files.length === 0 ? (
        <div style={{ ...box, padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No resources yet — upload one above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[...folders.entries()].map(([folder, list]) => (
            <div key={folder} style={{ ...box, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
                📁 {folder} <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 12 }}>· {list.length}</span>
              </div>
              {list.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 17 }}>{icon(f.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.uploaded_by ?? "—"} · {new Date(f.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                  </div>
                  {f.role === "all" && <span style={{ background: "var(--purple-bg)", color: "var(--purple-text)", borderRadius: 999, padding: "1px 8px", fontSize: 10.5, fontWeight: 700 }}>Shared</span>}
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 600, textDecoration: "none", color: "var(--brand-text)" }}>Download</a>
                  ) : <span style={{ color: "var(--muted)", fontSize: 11 }}>sample</span>}
                  <form action={deleteResourceFile}>
                    <input type="hidden" name="id" value={f.id} />
                    <button style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer", color: "var(--red-text)" }} title="Delete">✕</button>
                  </form>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
