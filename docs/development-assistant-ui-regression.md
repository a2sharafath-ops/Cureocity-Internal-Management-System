# AWS Development Assistant role regression

This workflow provisions synthetic Cureocity Assistant accounts and runs a non-mutating browser walkthrough for every staff role. It is intentionally restricted to the local AWS Development tunnel and refuses hosted Supabase or non-local app URLs.

## Scope and safety

- Covers all 13 staff roles, including the currently disabled Super Admin and Health Coach AI pilots.
- Uses only `@cureocity.test` synthetic identities marked with the dedicated `cureocity-assistant-role-regression-v1` scope.
- Never submits a checklist, creates an Assistant draft, invokes AI, requests microphone access or changes application records during browser tests.
- Stores generated credentials only in `.env.assistant-e2e.local`, which is Git-ignored and written with file mode `0600`.
- Does not target hosted Production. Both the Supabase URL and app URL must resolve to the expected localhost ports.

## Prerequisites

1. Keep the AWS Development tunnel running:

   ```bash
   ./scripts/dev-supabase-tunnel.sh
   ```

2. Ensure `.env.development.local` targets:

   - Supabase: `http://127.0.0.1:54321`
   - App: `http://127.0.0.1:3000`

3. Install the browser once on a new workstation:

   ```bash
   npx playwright install chromium
   ```

## Provision or rotate the synthetic accounts

```bash
npm run test:assistant:e2e:provision
```

The command is idempotent for identities created under its own synthetic scope. It does not print passwords. Re-running it keeps the same locally saved credentials and verifies that every profile has the intended real role.

## Run the regression suite

```bash
npm run test:assistant:e2e
```

The Playwright configuration reuses a running local app or starts one automatically. It checks anonymous denial, authenticated real-role identity, correct Assistant availability, role-specific controls, clean history loading, the global side panel, the full-workspace link and the disabled voice/privacy state. It deliberately does not click any “Prepare” action.

If a role is later enabled or disabled, the expected state is derived from `.env.development.local`; the test does not hard-code a Production assumption.
