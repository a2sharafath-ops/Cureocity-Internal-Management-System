-- Normalise leads.fde to the staff directory's full names.
--
-- The Excel import brought short first names ("Sini", "Tamanna", "Rohin") while
-- 0070 moved every other name column to full names. The Leads page resolves
-- these at render time, but that's a display patch over a data problem — this
-- fixes the stored values so exports, filters and any future query agree.
--
-- OPTIONAL. The page reads correctly without it. Run it if you'd rather the
-- column be right in the database than corrected on the way out.
--
-- Distribution at time of writing: Sini 441 · Tamanna 333 · Rohin 223 ·
-- Jobin 1 · null 1.

begin;

-- Exact prefix matches — these already resolve, this just makes them stored.
update leads set fde = 'Sini Antony'  where btrim(fde) = 'Sini';
update leads set fde = 'Jobin Mathew' where btrim(fde) = 'Jobin';

-- Spelling variant: the sheet wrote "Tamanna", the directory has "Thamanna
-- Nazer". No prefix rule can bridge that, so it's stated explicitly.
update leads set fde = 'Thamanna Nazer' where btrim(fde) in ('Tamanna', 'Thamanna');

-- "Rohin" has no staff row — the seed prune in 0069 removed them. Deliberately
-- left as-is: it's the true historical owner of 223 leads, and rewriting it to
-- null would destroy who actually worked those. The page renders unmatched
-- names in italic grey so they read as off-team rather than broken.

commit;

-- Verify:
--   select fde, count(*) from leads group by fde order by count(*) desc;
