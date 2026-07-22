# Instagram / Facebook Lead Ads — setup

When someone fills in the form built into one of your **paid lead-ads**, Meta
notifies your CRM and the lead lands in CRM & Leads — scored, owner-assigned by
rotation, with a call task waiting. Same pipeline as website leads, different
front door.

## This is ONLY for lead-form ads

This receives leads from the **Lead Ads** campaign objective — ads with a native
form (name, phone, etc.) that submits inside Instagram/Facebook. It does **not**
receive DMs, comments, or boosted-post engagement. If you don't run lead-form
campaigns, this endpoint will correctly receive nothing.

## Why it needs Meta approval (be realistic about timeline)

Unlike the website form, this needs a reviewed Meta app. Expect:

- A **Meta Developer** account and an app with the **Webhooks** and
  **Lead Ads** products added.
- **Business verification** of your Meta business.
- **App Review** for the `leads_retrieval` permission. Meta's current review
  cycle is strict — screencasts, a clear opt-out/description. Days to weeks, and
  the work is on your side, not in this codebase.

The code below is ready and waiting; the gating is entirely Meta's process.

## How it actually works (the surprising bit)

Meta's webhook does **not** contain the lead. It sends a `leadgen_id` and says
"come and fetch it". So on each lead the endpoint calls the Graph API with a
Page access token to pull the answers, then ingests them. That's why there are
three secrets, not one.

## 1. Set four environment variables in Vercel

On **Cureocity Health Intelligence** → Settings → Environment Variables. Value
box, not Note. Production ticked.

| Variable | What it is |
|---|---|
| `META_VERIFY_TOKEN` | Any random string you choose. You'll paste the same value into Meta's webhook config; it's only used for the subscription handshake. |
| `META_APP_SECRET` | Meta App Secret — App Settings → Basic. Verifies each webhook is genuinely from Meta. |
| `META_PAGE_ACCESS_TOKEN` | A long-lived Page token with `leads_retrieval`. Fetches the lead answers. |
| `META_LEAD_OWNER` | `s1,thamanna-nazer` — who owns IG-ad leads, least-loaded rotation. |

Redeploy after adding them.

## 2. Configure the webhook in the Meta app

- Product **Webhooks** → object **Page** (and/or **Instagram**) → subscribe to
  the **`leadgen`** field.
- Callback URL: `https://cureocity-internal-management-syste.vercel.app/api/leads/meta`
- Verify Token: the exact `META_VERIFY_TOKEN` value.
- Meta sends a `GET` handshake immediately. If the token matches, it verifies;
  if not, it shows an error — check the value matches on both sides.
- Subscribe your **Page** to the app for the `leadgen` field (Graph API call or
  the app's Webhooks UI).

## 3. Test with Meta's tool

Meta provides a **Lead Ads Testing Tool** (developers.facebook.com →
Lead Ads Testing Tool). Pick your page and form, click **Create Lead**. Within
seconds it should appear in CRM & Leads with source **Instagram** and an owner,
and a "Call … — new instagram lead" task on the Tasks page. Delete the test
lead afterwards.

## What lands in the CRM

| Meta form field | Becomes |
|---|---|
| `full_name` (or `first_name`+`last_name`) | Lead name |
| `phone_number` | Phone (deduped by last 10 digits) |
| `email` | Email |
| `city`, `state` | Location |
| interest/goal custom questions | Interest / Goals (feeds scoring) |
| any other custom question | Preserved into Notes |
| ad id / form id | Notes / Campaign — so you can tell which ad produced it |

A lead form that collects neither phone nor email is rejected as unworkable —
but standard lead forms always collect at least one.

## Reliability notes

- The endpoint **always returns 200** to Meta once the signature is valid, even
  when there's nothing to do. A non-200 makes Meta retry and eventually disable
  the subscription — worse than dropping one lead.
- Deduped by phone like every other source, so Meta's retries can't create
  duplicates.
- Inert and safe until all three `META_*` secrets are set: the handshake fails
  and every POST is rejected on signature.
