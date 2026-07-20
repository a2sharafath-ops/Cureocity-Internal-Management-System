type FileItem = {
  id: string;
  name: string | null;
  kind: string;
  url: string | null;
  created_at: string;
};

function label(kind: string) {
  if (kind === "blood_report") return "🩸 Blood report";
  if (kind === "progress_photo") return "📸 Progress photo";
  return "📄 Document";
}

export default function FilesGrid({ files }: { files: FileItem[] }) {
  if (!files.length) return <div style={{ color: "var(--muted)", fontSize: 13 }}>No files yet.</div>;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {files.map((f) =>
        f.kind === "progress_photo" && f.url ? (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.name ?? "photo"} style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
          </a>
        ) : (
          <a
            key={f.id}
            href={f.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, textDecoration: "none", color: "var(--ink)", background: "#fff" }}
          >
            <span style={{ background: "var(--neutral-bg)", color: "var(--muted)", borderRadius: 999, padding: "1px 8px", fontSize: 10 }}>{label(f.kind)}</span>
            {f.name ?? "file"}
          </a>
        )
      )}
    </div>
  );
}
