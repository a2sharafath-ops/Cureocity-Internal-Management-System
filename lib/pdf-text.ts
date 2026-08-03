// Pull the text out of a stored PDF so the AI can read it.
//
// Why: the InBody report arrives as a PDF the clinician uploads. Before this,
// uploading only filed the document for a human to open — the AI summary read
// nothing from it, so front desk could reasonably upload a report and wonder why
// "Generate" said there was no data. This bridges the two.
//
// `unpdf` is used because it's a serverless build of pdf.js: no native bindings,
// no canvas, no worker file to ship — it runs as-is in a Vercel Node function.

import "server-only";

/** Text of a PDF held in Supabase Storage, or null if it can't be read. */
export async function pdfTextFromStorage(
  supabase: { storage: { from: (b: string) => { download: (p: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  bucket: string,
  path: string,
  maxChars = 6000,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    // Imported lazily so the pdf.js bundle only loads when a PDF is actually read.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = String(text ?? "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!clean) return null;              // scanned/image-only PDF — nothing to read
    return clean.slice(0, maxChars);
  } catch {
    // A malformed or password-protected PDF must never break the surrounding
    // action — the caller falls back to whatever other data it has.
    return null;
  }
}
