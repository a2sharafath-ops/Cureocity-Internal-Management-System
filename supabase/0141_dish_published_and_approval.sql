-- Two things a dish needs before a published library can be imported.
--
-- 1. A PLACE FOR SOMEONE ELSE'S ARITHMETIC.
--
-- Until now a dish was priced one way: its ingredients, the food table, and
-- multiplication. That is still the preferred way and still wins wherever it
-- can be done. But a published databank arrives with its own per-serving
-- figures, worked out from the same kind of source and, in INDB's case, with
-- cooking retention factors this app does not model. Where our own ingredient
-- weights are incomplete, those figures are a better answer than no answer —
-- and a far better one than a weight somebody guessed to fill the gap.
--
-- They are kept in their own columns rather than written into the recipe, so
-- the two never get confused: `source_kcal` is what INDB says a serving
-- contains, and the app shows it as such. The moment the ingredients are
-- complete enough to compute, the computed figure takes over and these become
-- a cross-check.
--
-- 2. AN APPROVAL GATE.
--
-- A thousand recipes nobody at this clinic has read must not be selectable on
-- a client's chart. Every imported dish arrives unapproved; the chart's recipe
-- picker only offers approved ones. The dietitian works through them in
-- batches, and what she has not yet seen simply is not on offer.
--
-- Existing dishes — the ones she wrote herself — are approved by definition:
-- she authored them, which is the same act.

alter table dishes
  -- What one serving contains according to the source the recipe came from.
  -- Null for a dish somebody here wrote: there is no outside figure for it.
  add column if not exists source_kcal      numeric,
  add column if not exists source_protein_g numeric,
  -- Cleared for use on a client's chart.
  add column if not exists approved         boolean not null default false,
  add column if not exists approved_by      text,
  add column if not exists approved_at      timestamptz;

-- Anything already in the library was written by the clinic's own dietitian,
-- so it is approved: reviewing your own recipe is what writing it was.
update dishes set approved = true, approved_by = coalesce(created_by, 'Cureocity'), approved_at = now()
 where approved = false and source is null;

-- The citation doubles as the import key, so a recipe file can be re-run
-- without duplicating and a dish renamed here keeps its ingredients. Postgres
-- allows many nulls in a unique index, so hand-written dishes are unaffected.
create unique index if not exists dishes_source_key on dishes (source);

-- The picker filters on this, so it is worth an index once the library is
-- a thousand rows rather than a dozen.
create index if not exists dishes_approved_idx on dishes (approved);

-- ---- check afterwards -------------------------------------------------------
--   select approved, count(*) from dishes group by approved;
