# Website lead capture — setup

Your website form POSTs an enquiry; it lands in CRM & Leads already scored,
already owned, with a call task waiting for whoever owns it.

## 1. Set three environment variables in Vercel

| Variable | What it does | If unset |
|---|---|---|
| `WEBSITE_LEAD_SECRET` | Shared key the website sends in the `X-Cureocity-Key` header | Endpoint rejects everything (401) |
| `WEBSITE_LEAD_OWNER` | `staff.id` who owns website leads — e.g. `s1` | Lead still captured, but arrives unowned |
| `CRON_SECRET` | Unrelated to this form, but see the warning below | **All** nightly automation is dead |

Generate the secret with something like `openssl rand -hex 32`. It is not a
password anyone types — it lives in your website's server config.

> **Important:** `CRON_SECRET` was never set. Combined with the middleware bug
> fixed alongside this feature, that means the nightly automation has never run.
> Set it now, in Vercel, and add the same value as an `Authorization: Bearer …`
> header on the cron job.

## 2. Point your form at the endpoint

```
POST https://<your-domain>/api/leads/website
Content-Type: application/json
X-Cureocity-Key: <WEBSITE_LEAD_SECRET>
```

```json
{
  "name":     "Rozario Peter",
  "phone":    "8590059059",
  "email":    "rozario@example.com",
  "interest": "Personal Training",
  "goals":    "Lose weight",
  "location": "Kochi",
  "notes":    "Asked about morning slots"
}
```

Only `name` plus **one of** `phone` or `email` are required. `interest` and
`goals` are worth sending if your form asks — they feed lead scoring, so a lead
that supplies them arrives correctly tiered rather than defaulting to COLD.

**The key must never appear in browser JavaScript.** Post from your website's
server (a PHP/Node handler, a WordPress hook, a Next.js route). If the form
submits directly from the browser, anyone can read the key and spam your CRM.

### Responses

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ ok: true, status: "created", ref: 1004 }` | New lead, `ref` is its number |
| 200 | `{ ok: true, status: "duplicate" }` | Same phone within 30 days — show the visitor a thank-you anyway |
| 400 | `{ ok: false, error: "…" }` | Validation failed; the message says which field |
| 401 | `{ ok: false, error: "unauthorized" }` | Missing or wrong key |

## 3. Add a honeypot (optional, recommended)

Include a hidden field named `company` that real users never see:

```html
<input type="text" name="company" tabindex="-1" autocomplete="off"
       style="position:absolute;left:-9999px" aria-hidden="true">
```

Bots fill every field they find. If `company` arrives non-empty the submission
is silently discarded and still returns 200 — so the bot gets no signal that it
was caught, and no CAPTCHA is needed.

## 4. Test it

```bash
curl -i -X POST https://<your-domain>/api/leads/website \
  -H "Content-Type: application/json" \
  -H "X-Cureocity-Key: <WEBSITE_LEAD_SECRET>" \
  -d '{"name":"Test Enquiry","phone":"9000000001","interest":"Gym/Fitness"}'
```

Then open CRM & Leads. You should see the lead at the top with a tier badge and
an owner. Check the Tasks page for "Call Test Enquiry — new website lead".
Run the same command again — the second one returns `"duplicate"` and does not
create a second row.

Delete the test lead afterwards.

## What happens to a captured lead

1. **Validated** — name required, plus a phone or an email. Oversized fields are
   clipped. Only whitelisted fields are read, so a crafted payload cannot set
   `stage`, `score` or `owner_id` directly.
2. **Deduped by phone**, comparing the last 10 digits, so `+91 85900 59059` and
   `8590059059` are recognised as the same person. The window is 30 days — an
   enquiry from someone who asked six months ago is treated as genuinely new,
   because coming back is a real signal, not a duplicate.
3. **Scored** using the same 7-signal rubric as a lead typed in by hand, so it
   arrives with a HOT/WARM/COOL/COLD tier.
4. **Assigned** to `WEBSITE_LEAD_OWNER`. This matters more than it looks: an
   unowned lead is invisible to the daily no-next-step digest and the callback
   sweep.
5. **Tasked** — a high-priority "Call {name}" task, due today, linked to the
   lead, assigned to its owner.

## Adding Instagram or WhatsApp later

Both route through the same `ingestLead()` function in `lib/ingest-lead.ts`.
Only the payload mapping differs — dedupe, scoring, ownership and the call task
are shared, so the second and third sources are considerably smaller jobs than
this first one was.
