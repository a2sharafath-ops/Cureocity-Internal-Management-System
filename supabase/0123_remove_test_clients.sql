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
-- No temp tables: the Supabase SQL Editor pools connections per statement, so
-- a `create temporary table … on commit drop` is gone before the next line
-- runs. Every statement names the three codes itself.
-- ============================================================================

-- ---- 0. Look before you leap ----------------------------------------------
-- Run this on its own first. Expect exactly three rows.
--
--   select id, code, name, joined, phone from clients
--    where code in ('CUR-001','CUR-002','CUR-003');

-- ---- 1. safety catch -------------------------------------------------------
-- Aborts the whole script if the codes do not match exactly three clients.
do $$
declare n int;
begin
  select count(*) into n from clients where code in ('CUR-001', 'CUR-002', 'CUR-003');
  if n <> 3 then
    raise exception 'Expected 3 clients, found %. Nothing deleted.', n;
  end if;
end $$;

-- ---- 2. the "on delete set null" tables ------------------------------------
-- These eleven do NOT cascade. Deleting the client would leave the rows alive
-- with a null client_id: 7 invoices haunting finance reports, 12 tasks on the
-- board belonging to nobody. So they go first, explicitly.
delete from invoices            where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from tasks               where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from sales               where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from checkins            where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from email_log           where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from mdt_notes           where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from passes              where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from telehealth_sessions where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from trainer_slots       where client_id   in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));
delete from referrals           where referrer_id in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));

-- A portal login would be left pointing at nothing. None exist today; this
-- keeps the script correct if one is created before it runs.
update profiles set client_id = null
 where client_id in (select id from clients where code in ('CUR-001','CUR-002','CUR-003'));

-- ---- 3. the clients — cascade takes the other ~40 tables ------------------
-- appointments, consultations, sessions, measurements, vitals, files,
-- followups, care_protocols, client_packages, client_assignments, blueprints,
-- prescriptions, orders, diet_charts, habits, problems, medications,
-- allergies, whiteboard_cards, and the rest.
delete from clients where code in ('CUR-001', 'CUR-002', 'CUR-003');

-- ---- 4. afterwards ---------------------------------------------------------
-- Expect zero from all three:
--
--   select count(*) from clients   where code in ('CUR-001','CUR-002','CUR-003');
--   select count(*) from invoices  where client_id is null;
--   select count(*) from followups where client_id not in (select id from clients);
--
-- NOT covered by this script: the uploaded PDFs themselves. The `files` rows
-- are gone, but the objects still sit in the `client-files` storage bucket —
-- the InBody sheets and the sample blood report. Delete those from
-- Storage → client-files in the Supabase dashboard, or they stay as
-- unreferenced blobs nobody can reach from the app.
