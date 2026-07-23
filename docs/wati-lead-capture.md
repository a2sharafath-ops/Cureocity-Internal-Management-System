# Wati (WhatsApp) lead capture — setup

When a new person messages your WhatsApp for the first time — including people
who tap a **Click-to-WhatsApp** ad on Instagram/Facebook — Wati notifies your
CRM and the lead lands in **CRM & Leads**: scored, owner-assigned by rotation,
with a call task waiting. Same pipeline as website and Meta leads, different
front door.

## What this captures (and what it doesn't)

- **Captures:** the first inbound WhatsApp message from a *new* contact. This is
  the dominant lead flow for a WhatsApp-first setup and pairs perfectly with
  Click-to-WhatsApp ads.
- **Does not capture (by design, for now):** ongoing conversations, or
  Instagram/Facebook **instant lead-form** submissions where the person never
  actually messages you. Those live in Wati / Meta Leads Centre. If you want
  those too, that's a separate wiring step.

## 1. Set two environment variables in Vercel

On **Cureocity Health Intelligence** → Settings → Environment Variables. Paste
into the **Value** box (not Note), Production ticked, then redeploy.

| Variable | What it is |
|---|---|
| `WATI_WEBHOOK_SECRET` | Any random string you choose. Wati's webhook UI has no header field, so it goes in the webhook **URL** as `?token=…`. |
| `WATI_LEAD_OWNER` | `s1,thamanna-nazer` — who owns WhatsApp leads, least-loaded rotation. |

## 2. Add the webhook in Wati

Wati → **Connectors → Webhooks → Add Webhook**:

- **URL** (include the token — this is the credential, keep the URL private):
  `https://cureocity-internal-management-syste.vercel.app/api/leads/wati?token=<the WATI_WEBHOOK_SECRET value>`
- **Status:** Enabled
- **Event:** **New Contact Message** if your plan offers it; otherwise
  **Message Received** works too. The endpoint handles both, and dedupe means
  only the *first* message from a new number becomes a lead — later messages are
  ignored.

Wati's simplified webhook dialog has no custom-header option, which is why the
secret rides in the URL. Wati requires a 200 response; this endpoint always
returns 200 once the token is valid, so Wati won't disable it.

## 3. Test

From another phone, send a **first-time** WhatsApp message to your business
number (a number Wati has never seen before). Within a few seconds it should
appear in CRM & Leads with source **WhatsApp** (or **WhatsApp Ad** if it came
through a Click-to-WhatsApp ad) and an owner, plus a "Call … — new whatsapp
lead" task on the Tasks page. The first message text is saved into the lead's
notes.

## What lands in the CRM

| Wati field | Becomes |
|---|---|
| `waId` | Phone (deduped by last 10 digits) |
| `senderName` | Lead name (falls back to "WhatsApp lead" if blank) |
| `sourceUrl` / `sourceId` | Preserved into Notes so you can see which ad produced it |

## Reliability notes

- Deduped by phone like every other source, so a returning enquirer within 30
  days won't create a duplicate; someone who messaged months ago counts as a
  genuinely new enquiry.
- Only the **New Contact Message** event creates a lead; any other Wati event is
  acknowledged (200) and ignored.
- Inert and safe until `WATI_WEBHOOK_SECRET` is set — every request is rejected
  with 401.
