-- ============================================================================
-- Cureocity — remove the three test clients and everything attached to them.
--
--   CUR-001  Test Client 1
--   CUR-002  Test Client 2
--   CUR-003  Sha
--
-- THIS IS IRREVERSIBLE. Take a backup first if you want any way back.
--
-- Scoped by client CODE, not by name: a real client called "Sha" would match a
-- name filter, a code cannot be typed by accident. Leads are untouched — none
-- share these names, and the lead table is production data.
--
-- Most child tables are `on delete cascade`, so deleting the client removes
-- them. Eleven are `on delete set null` (invoices, tasks, sales, checkins,
-- email_log, mdt_notes, passes, telehealth_sessions, trainer_slots, referrals,
-- profiles) — those rows would SURVIVE with a null client_id and haunt finance
-- reports and task boards as unattached orphans, so they are deleted first.
-- ============================================================================

-- ---- 0. Look before you leap ----------------------------------------------
-- Confirm you are about to remove exactly three clients, and see what goes.
--
--   select id, code, name, joined, phone from clients
--    where code in ('CUR-001','CUR-002','CUR-003');
--
--   select 'invoices' t, count(*) from invoices  where client_id in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'))
--   union all select 'tasks',        count(*) from tasks         where client_id in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'))
--   union all select 'consultations',count(*) from consultations where client_id in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'))
--   union all select 'appointments', count(*) from appointments  where client_id in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'))
--   union all select 'sessions',     count(*) from sessions      where client_id in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));

begin;

create temporary table _doomed on commit drop as
  select id from clients where code in ('CUR-001', 'CUR-002', 'CUR-003');

-- Safety catch: stop if that did not match exactly three clients.
do $$
declare n int;
begin
  select count(*) into n from _doomed;
  if n <> 3 then
    raise exception 'Expected 3 clients, found %. Nothing deleted.', n;
  end if;
end $$;

-- ---- 1. the "set null" tables, which would otherwise be orphaned -----------
delete from invoices            where client_id  in (select id from _doomed);
delete from tasks               where client_id  in (select id from _doomed);
delete from sales               where client_id  in (select id from _doomed);
delete from checkins            where client_id  in (select id from _doomed);
delete from email_log           where client_id  in (select id from _doomed);
delete from mdt_notes           where client_id  in (select id from _doomed);
delete from passes              where client_id  in (select id from _doomed);
delete from telehealth_sessions where client_id  in (select id from _doomed);
delete from trainer_slots       where client_id  in (select id from _doomed);
delete from referrals           where referrer_id in (select id from _doomed);

-- A portal login would be left pointing at nothing. None exist today; this
-- keeps the script correct if one is created before it runs.
update profiles set client_id = null where client_id in (select id from _doomed);

-- ---- 2. the clients — cascade takes the other ~40 tables ------------------
-- appointments, consultations, sessions, measurements, vitals, files,
-- followups, care_protocols, client_packages, client_assignments, blueprints,
-- prescriptions, orders, diet_charts, habits, problems, medications,
-- allergies, whiteboard_cards, and the rest.
delete from clients where id in (select id from _doomed);

commit;

-- ---- 3. afterwards ---------------------------------------------------------
-- Expect zero rows from all of these:
--
--   select count(*) from clients      where code in ('CUR-001','CUR-002','CUR-003');
--   select count(*) from invoices     where client_id is null;
--   select count(*) from followups    where client_id not in (select id from clients);
--
-- NOT covered by this script: the uploaded PDFs themselves. The `files` rows
-- are gone, but the objects still sit in the `client-files` storage bucket —
-- the InBody sheets and the sample blood report. Delete those from
-- Storage → client-files in the Supabase dashboard, or they stay as
-- unreferenced blobs nobody can reach from the app.
