-- 0119_drop_bogus_flags.sql
-- One-off data correction, not a schema change.
--
-- Two flags on Sha's doctor consultation were raised from the misaligned
-- questionnaire (see 0117): the values 78% and 192 mg/L came from a heart rate
-- and a platelet count that had been filed under the wrong questions. His real
-- results are HbA1c 5.5% and hsCRP 1.8 mg/L, both normal.
--
-- A flag is a clinical assertion on a client record, so these are removed
-- rather than left for someone to disbelieve later. The two accurate flags
-- (body fat 28%, visceral fat 10) are kept.

-- Look first:
--   select jsonb_pretty(flags) from consultations
--    where id = '57c8bbc5-a640-4a8d-b4dc-2a8f3bea7b46';

update consultations
   set flags = coalesce((
         select jsonb_agg(f)
           from jsonb_array_elements(flags) f
          where f->>'text' not in (
            'HbA1c 78% — in the diabetic range, confirm',
            'hsCRP 192 mg/L — high cardiovascular risk band'
          )
       ), '[]'::jsonb)
 where id = '57c8bbc5-a640-4a8d-b4dc-2a8f3bea7b46';

-- Expect 2 flags remaining.
