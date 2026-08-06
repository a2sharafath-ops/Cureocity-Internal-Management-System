// Sending a document to a client's WhatsApp, through Wati.
//
// The inbound half already exists (app/api/leads/wati/route.ts turns an
// incoming message into a lead). This is the outbound half: attaching a
// rendered PDF to an approved template message.
//
// Two things outside our control gate this, and both fail loudly rather than
// quietly: Meta must have APPROVED the template, and the PDF must be reachable
// at a URL Wati's servers can fetch. Neither can be worked around in code.

export type WatiTemplate = {
  /** The template name as approved in Wati — not the display text. */
  name: string;
  /** Body variables in order. Wati names them "1", "2", … */
  params: string[];
};

/** Which approved template carries each document. Overridable per environment
 *  so a rename in Wati doesn't need a deploy. */
export function templateFor(kind: string): string {
  const env: Record<string, string | undefined> = {
    plan: process.env.WATI_TEMPLATE_PLAN,
    rx: process.env.WATI_TEMPLATE_RX,
    lab: process.env.WATI_TEMPLATE_LAB,
    summary: process.env.WATI_TEMPLATE_SUMMARY,
  };
  const fallback: Record<string, string> = {
    plan: "diet_plan_ready",
    rx: "prescription_ready",
    lab: "lab_request_ready",
    summary: "consultation_summary_ready",
  };
  return env[kind] || fallback[kind] || "";
}

/**
 * Put an Indian mobile number into the form Wati expects: digits only, country
 * code included, no plus.
 *
 * Numbers arrive from half a dozen places — typed at the front desk, imported
 * from a spreadsheet, captured from an Instagram lead — so they show up as
 * "+91 96459 99972", "09645999972", "9645999972" and worse. Sending to an
 * unnormalised number doesn't error; it silently goes nowhere, which is the
 * worst kind of failure.
 *
 * Returns null when it isn't a number we can send to, so the caller reports
 * that instead of firing into the void.
 */
export function normalisePhone(raw: string | null | undefined, defaultCc = "91"): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;

  // 00 91 … — the international prefix written the old way.
  if (d.startsWith("00")) d = d.slice(2);
  // A single leading 0 is the Indian trunk prefix, not part of the number.
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);

  // Already carries the country code.
  if (d.length === 12 && d.startsWith(defaultCc)) return d;
  // A bare 10-digit mobile. Indian mobiles start 6–9; anything else is a
  // landline or a typo, and sending to it wastes a template send.
  if (d.length === 10) return /^[6-9]/.test(d) ? `${defaultCc}${d}` : null;
  // Some other country, already in full international form.
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

export type WatiReadiness = { ready: boolean; missing: string[] };

export function watiReadiness(): WatiReadiness {
  const missing: string[] = [];
  if (!process.env.WATI_API_ENDPOINT) missing.push("WATI_API_ENDPOINT");
  if (!process.env.WATI_ACCESS_TOKEN) missing.push("WATI_ACCESS_TOKEN");
  return { ready: missing.length === 0, missing };
}

export type SendResult = { ok: boolean; error?: string };

/**
 * Send one approved template with a document attached.
 *
 * `mediaUrl` must be publicly fetchable by Wati's servers for as long as the
 * send takes — a signed link with a generous expiry, not a link behind our
 * login. `fileName` is what the client sees when they save the attachment.
 *
 * The payload matches Wati's v1 sendTemplateMessage. Their API returns 200 with
 * `result: false` on a rejected send rather than an HTTP error, so the body is
 * checked as well as the status — otherwise a refused send would look like a
 * successful one.
 */
export async function sendDocument(opts: {
  phone: string;
  template: WatiTemplate;
  mediaUrl: string;
  fileName: string;
}): Promise<SendResult> {
  const { ready, missing } = watiReadiness();
  if (!ready) return { ok: false, error: `WhatsApp isn't set up — missing ${missing.join(", ")}.` };

  const to = normalisePhone(opts.phone);
  if (!to) return { ok: false, error: `"${opts.phone}" isn't a number we can send to.` };
  if (!opts.template.name) return { ok: false, error: "No approved template configured for this document." };

  const endpoint = String(process.env.WATI_API_ENDPOINT).replace(/\/+$/, "");
  const url = `${endpoint}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(to)}`;

  const body = {
    template_name: opts.template.name,
    broadcast_name: `${opts.template.name}_${Date.now()}`,
    parameters: [
      ...opts.template.params.map((value, i) => ({ name: String(i + 1), value })),
      // The document header. Wati takes the media by URL and the display name
      // separately; without both the template arrives with no attachment.
      { name: "document_url", value: opts.mediaUrl },
      { name: "document_name", value: opts.fileName },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: String(process.env.WATI_ACCESS_TOKEN),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Wati ${res.status}: ${text.slice(0, 200)}` };

    // A refused send comes back 200 with result:false. Treating that as success
    // would mark the document delivered when it never arrived.
    try {
      const json = JSON.parse(text) as { result?: boolean; ok?: boolean; info?: string; message?: string };
      if (json.result === false || json.ok === false) {
        return { ok: false, error: json.info || json.message || "Wati refused the send." };
      }
    } catch { /* not JSON — a 200 with a non-JSON body is unusual but not fatal */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
