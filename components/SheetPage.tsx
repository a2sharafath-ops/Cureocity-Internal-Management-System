import type { DocSheet, AppSettings } from "@/lib/settings";
import { brandLogo } from "@/lib/settings";

/**
 * One printable A4 sheet.
 *
 * The uploaded artwork is the page background at true A4 size, and everything
 * we print sits inside the safe area the admin set in Templates. That split
 * matters: the design is theirs to change in Canva without touching code, and
 * the content stays laid out by us so a long drug list still paginates.
 *
 * With no artwork uploaded it falls back to a plain letterhead built from the
 * clinic details already in settings, so the document is never unusable.
 */
export function SheetStyles({ sheet }: { sheet: DocSheet }) {
  return (
    <style>{`
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0; padding: 0; background: #f3f4f6; }
      * { box-sizing: border-box; }
      .sheet {
        position: relative;
        width: 210mm; min-height: 297mm;
        margin: 0 auto; background: #fff;
        padding: ${sheet.top}mm ${sheet.side}mm ${sheet.bottom}mm;
      }
      /* The artwork repeats on every printed page, so a two-page prescription
         is still on letterhead. */
      .sheet-bg {
        position: fixed; inset: 0;
        width: 210mm; height: 297mm;
        left: 50%; transform: translateX(-50%);
        object-fit: cover; z-index: 0;
      }
      .sheet-body { position: relative; z-index: 1; }
      @media screen {
        .sheet { box-shadow: 0 2px 18px rgba(0,0,0,.13); margin: 18px auto; }
        .sheet-bg { position: absolute; transform: none; left: 0; }
      }
      @media print {
        .no-print { display: none !important; }
        .sheet { box-shadow: none; margin: 0; }
      }
      .rx-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
      .rx-table th {
        text-align: left; font-size: 10px; letter-spacing: .5px; text-transform: uppercase;
        color: #6b7280; border-bottom: 1.5px solid #d1d5db; padding: 0 8px 5px 0; font-weight: 700;
      }
      .rx-table td { padding: 9px 8px 9px 0; border-bottom: 1px solid #eceff3; vertical-align: top; }
      .rx-table tr { break-inside: avoid; }
    `}</style>
  );
}

/** Plain letterhead, used only when no artwork has been uploaded. */
export function FallbackHead({ s }: { s: AppSettings }) {
  const lh = s.letterhead;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, borderBottom: `2px solid ${s.brand.color || "#e11d48"}`, paddingBottom: 12, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brandLogo(s)} alt="" width={40} height={40} style={{ display: "block", maxWidth: 46, maxHeight: 46 }} />
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.4px", color: "#111" }}>{lh.name}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: "#555", lineHeight: 1.5 }}>
        <div>{lh.addr1}</div>
        <div>{lh.addr2}</div>
        <div>{lh.phone} · {lh.email}</div>
      </div>
    </div>
  );
}

/** Client / prescriber block — identical on both documents so they read as a set. */
export function PatientBlock({
  name, code, age, gender, doctor, date, docNo, title,
}: {
  name: string; code: string | null; age: number | null; gender: string | null;
  doctor: string | null; date: string; docNo: string; title: string;
}) {
  const cell = (k: string, v: string) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".5px", color: "#9ca3af", fontWeight: 700 }}>{k}</div>
      <div style={{ fontSize: 12.5, color: "#111", fontWeight: 600, overflowWrap: "anywhere" }}>{v || "—"}</div>
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".3px", textTransform: "uppercase", color: "#111" }}>{title}</div>
        <div style={{ fontSize: 10.5, color: "#9ca3af", fontWeight: 600 }}>No. {docNo}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px 14px", padding: "10px 0 12px", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
        {cell("Client", name)}
        {cell("ID", code ?? "—")}
        {cell("Age / Sex", [age ? `${age} yrs` : null, gender].filter(Boolean).join(" / "))}
        {cell("Date", date)}
        {cell("Prescribed by", doctor ?? "—")}
      </div>
    </>
  );
}
