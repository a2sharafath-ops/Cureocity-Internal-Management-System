# Cureocity — Internal Management System (web app)

Production rebuild of the Cureocity prototype as a live web app.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage) · GitHub → Vercel.

---

## One-time setup (you do these — they involve accounts & secret keys)

### 1. Install dependencies locally

In the Antigravity terminal, from this folder:

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should see the Cureocity scaffold page.

### 2. Create the Supabase project

1. Go to https://supabase.com → **New project**.
2. Once created, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret — server only)

### 3. Add your local env file

Copy `.env.example` to `.env.local` and paste your values:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored and never committed.

### 4. Create the GitHub repo

1. Create an **empty** repo on GitHub (no README).
2. Connect this folder to it (once):

```bash
git init
git add .
git commit -m "Initial scaffold"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

(You do this first push so your Git credentials get set up. After that, Claude can push for you.)

### 5. Connect Vercel

1. Go to https://vercel.com → **Add New → Project** → import your GitHub repo.
2. In **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy. From now on, **every push to `main` auto-deploys.**

---

## The working loop (with Claude)

1. You prompt Claude for a change.
2. Claude edits files here and smoke-tests.
3. You preview locally: `npm run dev` in Antigravity.
4. You confirm.
5. You say **"push"** → Claude runs `git add / commit / push` → Vercel deploys.

> Claude never handles your passwords, API keys, or Vercel/GitHub logins. You paste secrets into `.env.local` and the Vercel dashboard yourself.

---

## Project layout

```
app/            App Router pages & layouts (UI, ported from the prototype)
components/      Reusable React components (added as we port views)
lib/supabase/    Supabase browser + server clients
supabase/        SQL schema, RLS policies, seed (added next)
```

## Migration status

- [x] Scaffold (Next.js + Tailwind + Supabase clients + theme)
- [ ] Database schema + RLS + seed (Anjoom / Aquib / Minhas)
- [ ] Auth + role gating + app shell/nav
- [ ] Port views: CRM/Clients → Packages/Sessions → Trainer → Pro workspaces → BluePrint → Portal
- [ ] Storage, notifications, audit, polish
