# Cureocity — Internal Management System

## Working with Sharafath

**Sharafath is not a coder.** Write for someone who understands the business
inside out but does not read code and does not use a terminal day to day.

### Always end a piece of work with the exact terminal commands

This is the standing rule. Whenever a build, fix or change is finished, close
the reply with a copy-pasteable block — no gaps to fill in, no "commit your
changes" as an instruction, the literal commands:

```bash
cd ~/Downloads/cureocity-app
git add <the specific files that changed>
git commit -m "what changed"
git push origin main
```

Rules for that block:

- **Name the files explicitly.** Never `git add -A` unless everything in the
  tree genuinely belongs in the commit. Sharafath often has unrelated
  work-in-progress sitting uncommitted; sweeping it into a commit is a real
  cost. Check `git status` first and stage only what changed for this task.
- **Quote paths containing parentheses**, e.g. `"app/(app)/journey/page.tsx"`.
- **One block, in order, ready to paste.** Not prose describing the steps.
- **Say what will happen after** — e.g. "Vercel will rebuild in a minute or two,
  then hard-refresh with Cmd+Shift+R."
- Claude can run `git add` and `git commit` directly; only `git push` needs to
  be done by Sharafath (the sandbox has no GitHub credentials). Offer to do the
  commit, then hand over just the push line.

### Other things that help

- **Say plainly whether something is broken or fine.** Distinguish a real
  failure from expected behaviour that merely looks odd — e.g. a dash in a
  timer column, a blank field that is blank by design.
- **Deployment is not automatic from a commit.** A local commit changes
  nothing on the live site. Always be explicit about whether what he is looking
  at is local (`localhost:3000`) or deployed (the Vercel URL), because he tests
  in both and they drift apart.
- **Warn before production side effects.** Selling a test package raises a real
  invoice; removing a UI control takes it away from Front Desk staff the moment
  it deploys.
- Give the click path when describing a test: which page, which sidebar item,
  which button — not just the outcome to expect.

## Project facts worth remembering

- Repo lives at `~/Downloads/cureocity-app`. Branch `main`, deploys to Vercel.
- Stack: Next.js (App Router, server actions in `lib/actions.ts`), Supabase
  with RLS, vitest for tests.
- Verify with: `npx tsc -p tsconfig.json --noEmit`, `npm test`, `npx eslint .`
  (there are ~54 pre-existing warnings; 0 errors is the bar).
- `node_modules` holds macOS binaries, so vitest cannot run in a Linux sandbox
  without Linux builds of rollup and esbuild supplied via `NODE_PATH` and
  `ESBUILD_BINARY_PATH`.
- Roles matter constantly: Front Desk cannot start consultations; Administrator
  can act as any discipline. The "View as…" switcher is how he changes role.
