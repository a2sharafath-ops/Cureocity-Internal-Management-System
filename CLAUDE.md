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
- **Quote paths containing parentheses**, e.g. `"app/(app)/workspace/page.tsx"`.
- **One block, in order, ready to paste.** Not prose describing the steps.
- **Say what will happen after** — e.g. "Vercel will rebuild in a minute or two,
  then hard-refresh with Cmd+Shift+R."
- Claude can run `git add` and `git commit` directly; only `git push` needs to
  be done by Sharafath (the sandbox has no GitHub credentials). Offer to do the
  commit, then hand over just the push line.

### Name things the way they appear on screen, not in the code

Sharafath navigates by what he can see in the app. Table names, column names,
function names and file paths mean nothing to him and make an answer harder to
act on. Describe every part of the system by its visible label and the page it
lives on.

| Don't say | Say |
|---|---|
| `clients.goals` | the **Primary goal** on the client's page |
| the `consultations` table | consultations in **Workspace → Summaries** |
| RLS / a policy | who's allowed to see or change it |
| a null value | the field is empty |

When something has no visible counterpart at all — a database column nobody
displays, a background job — say what it *does* in plain language rather than
naming it.

Exception: the terminal commands themselves must stay literal and exact. Those
are for pasting, not reading.

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
  (there are ~56 pre-existing warnings; 0 errors is the bar).
- **Migrations must be parsed before they are handed over**: `python3
  scripts/check-sql.py` (needs `pip install pglast --break-system-packages`).
  It runs PostgreSQL's own grammar over every file in `supabase/`. This is not
  optional politeness — 0153 reached Sharafath with a syntax error that a
  bracket count and a regex both waved through, because the generator put each
  row's comment *after* the values tuple and the separating comma ended up
  inside the comment. Whenever a migration's rows are produced by a script, put
  the comment on the line ABOVE the row.
- `node_modules` holds macOS binaries, so vitest needs Linux builds of rollup
  and esbuild before it will run in a sandbox. This works, and means the tests
  can be run for him rather than handed over unverified:

  ```bash
  mkdir -p /tmp/vt && cd /tmp/vt
  # BOTH in one package.json — `npm i --no-save` prunes whatever is not listed,
  # so installing them one at a time silently deletes the other.
  # Versions must match the repo's own: node -p "require('rollup/package.json').version"
  cat > package.json <<'EOF'
  { "name": "vt", "private": true, "dependencies": {
      "@rollup/rollup-linux-arm64-gnu": "4.62.2",
      "@esbuild/linux-arm64": "0.21.5" } }
  EOF
  npm install
  cd ~/Downloads/cureocity-app
  NODE_PATH=/tmp/vt/node_modules \
  ESBUILD_BINARY_PATH=/tmp/vt/node_modules/@esbuild/linux-arm64/bin/esbuild \
  npx vitest run
  ```

  The sandbox is arm64; `linux-x64` packages refuse to install. esbuild's
  version must match the repo's exactly or it reports a host/binary mismatch.
  `tsc` is pure JavaScript and needs none of this.
- **`.next` grows to gigabytes.** It reached 12 GB once and filled the disk,
  which broke `tsc` and vitest with `ENOSPC` — errors that look like code
  faults and are not. If tooling fails strangely, check `df -h /` first.
  `rm -rf ~/Downloads/cureocity-app/.next` is always safe; it rebuilds.
- Roles matter constantly: Front Desk cannot start consultations; Administrator
  can act as any discipline. The "View as…" switcher is how he changes role.

## The diet chart: how its numbers work

The rule the clinic settled on, and the reason most of this exists: **a chart's
calories and protein are calculated, never remembered.** A dietitian recalling a
figure and a language model producing one are the same failure wearing different
clothes. Anything that would put a plausible number on a client's chart without
something behind it is the thing to refuse.

Where the numbers come from, in order of preference:

1. **Calculated here.** An option on the **Diet chart** builder is built from a
   list of recipes under **Dishes**, each with a portion, and its figures are the
   sum. A recipe is its ingredients in grams against the food table. Correct an
   ingredient and every chart still open re-prices itself.
2. **Quoted from the source.** Imported recipes carry the per-serving figures
   their databank published. Used only where our own ingredient weights are
   incomplete. The screen always says which of the two it is showing —
   *"quoted, not calculated"*.
3. **Nothing.** Where neither is available the dish is unpriced, says why, and
   cannot be used until someone fixes it.

Four things that will look like bugs and are not:

- **A recipe with figures that still says it cannot be computed.** When our own
  sum disagrees with the published figure by more than 25% we distrust *ours*
  and keep theirs. It is nearly always a deep-fried dish listing the whole pan
  of oil, of which the food absorbs a fraction — a poori computes to 4,264 kcal
  against a published 921. **Dishes → Needs a look** is that list.
- **Imported recipes not appearing in the chart's picker.** Every imported dish
  arrives unapproved and the picker only offers approved ones. **Dishes → Not
  approved** is the review queue; *Approve the N shown* clears what is on
  screen, deliberately not everything.
- **A new chart version demanding a Save before it can be approved.** A version
  copied from a published chart carries figures frozen at the time; published
  charts are never re-priced behind the client's back. Saving recomputes it.
- **Ingredients with no food code.** Four INDB ingredients have no composition
  anywhere; they are stored with name and weight only, which is the schema's
  intent, not a broken import.

Where things live: `lib/nutrition.ts` (pure arithmetic, well tested),
`lib/diet-plan.ts` (chart shapes and every refusal message), `lib/dish-pricing.ts`
(computed-then-published), `components/DietPlanBuilder.tsx`,
`components/DishLibrary.tsx`. Migrations 0139–0143.

The library is the **Indian Nutrient Databank** (Jaacks et al., Edinburgh):
1,014 recipes, ~429 calculated here, the rest quoted. Unit conversions are
sourced from USDA FoodData Central with every FDC id cited at the top of
`0142_indb_2_ingredients.sql`. **USDA writes measures as `tsp, ground` and
`9 sprigs`, not a bare `tsp`** — matching only the bare form silently loses
about four hundred recipes, which happened once. Licensing with the INDB authors
was still outstanding as of the import.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
