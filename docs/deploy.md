# Deploys

Production deploys are triggered two ways, for redundancy:

1. **Native Vercel Git integration** — Vercel's built-in "deploy on push". This is
   what we've always used, but its GitHub webhook is occasionally dropped, so a
   pushed commit sometimes never gets built and the site stays on the old bundle.
2. **GitHub Action deploy hook** (`.github/workflows/deploy.yml`) — a backstop that
   runs on GitHub's own infrastructure and pings a Vercel Deploy Hook on every push
   to `main`. This trigger cannot be silently dropped, so at least one of the two
   paths always fires. Result: one push, one deploy — no more "empty commit" dance.

## One-time setup (do this once)

1. **Create the Vercel Deploy Hook**
   - Vercel dashboard → the **production** project (the full app, not the frozen
     `cureocitycrm` pilot) → **Settings → Git → Deploy Hooks**.
   - Name it e.g. `github-actions`, set the branch to **`main`**, click **Create Hook**.
   - Copy the generated URL (looks like `https://api.vercel.com/v1/integrations/deploy/prj_.../...`).
   - Treat this URL as a secret — anyone with it can trigger a deploy.

2. **Add it as a GitHub secret**
   - GitHub → the repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `VERCEL_DEPLOY_HOOK`
   - Value: the URL from step 1.

3. **Commit & push** `.github/workflows/deploy.yml` and this file. The workflow only
   runs once it's on `main`.

## After setup

- Every push to `main` shows a run under the repo's **Actions** tab. Green = deploy
  triggered. If Vercel ever stalls, open **Actions**, pick the latest run, and
  confirm it succeeded — or use **Run workflow** (manual trigger) to redeploy the
  current `main` without any code change. This replaces the empty-commit workaround.

## If you ever want a single deploy path instead of two

Occasionally both triggers fire and you'll see two builds for one push. Harmless
(latest wins), but if you'd rather have exactly one, disable Vercel's native
auto-deploy for `main` by adding this to `vercel.json` and relying solely on the
Action:

```json
"git": { "deploymentEnabled": { "main": false } }
```
