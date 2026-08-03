-- 0118_dedupe_console_vitals.sql
-- One-off cleanup, not a schema change. Optional — nothing is broken if you
-- skip it, you just keep the extra rows.
--
-- The console's "Save vitals" button called addVitals, which always inserted.
-- Pressing it more than once in a session stacked near-identical rows for the
-- same client and date — Sha has three for 04 Aug 2026. The console now asks
-- for one row per day (once_per_day), so this only tidies what accumulated
-- before that fix. The EMR keeps the append behaviour, because a second reading
-- on the same day is a legitimate observation there.
--
-- Deliberately scoped to Sha (CUR-003). A blanket dedupe across the whole
-- vitals table would also collapse genuine pre/post readings recorded from the
-- EMR for other clients, and those are real data, not duplicates.

-- 1. Look before deleting — confirm which rows would go.
--    select id, date, systolic, diastolic, pulse, spo2, temp_c, weight, recorded_by, created_at
--      from vitals
--     where client_id = (select id from clients where code = 'CUR-003')
--     order by date desc, created_at desc;

-- 2. Keep only the most recent row per date, for this one client.
delete from vitals v
 where v.client_id = (select id from clients where code = 'CUR-003')
   and exists (
     select 1 from vitals keep
      where keep.client_id = v.client_id
        and keep.date      = v.date
        and keep.created_at > v.created_at
   );

-- To tidy another client later, change the code above. Do not remove the
-- client_id filter: unscoped, this deletes legitimate repeat readings.
