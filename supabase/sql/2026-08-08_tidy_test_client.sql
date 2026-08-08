-- ============================================================================
-- Cureocity — three small housekeeping jobs. NOT a migration: this is one-off
-- data, safe to run once and then forget. Run it in the SQL Editor.
--
--   1. Deliver Test Client 1's diet plan (published, never shared)
--   2. Add the Initial Psychology Consultation service
--   3. Replace the real 2024 bloodwork sitting on Test Client 1's record
--
-- Nothing here deletes a client, a lead or an invoice.
-- ============================================================================


-- ---- 1. The diet plan that was written, approved, and never delivered -------
--
-- `status = 'published'` means the Medical Director signed it off. `shared_at`
-- is what actually puts it in the client's portal — approval publishes, it does
-- not deliver. This plan has been sitting in that gap.
--
-- Doing it here rather than in the UI only because you asked me to; the Share
-- button on the dietitian's plan does exactly this.

update diet_plans
   set shared_at = now()
 where client_id = '2193690d-6b30-480f-b67d-87c4d85890b3'
   and status = 'published'
   and shared_at is null;


-- ---- 2. Initial Psychology Consultation ------------------------------------
--
-- Decided a while back and never created: the Psychologist had a discipline, a
-- workspace and matching rules, but no service anyone could book.
--
-- `day_offset = null` on purpose. A null offset means "not a protocol
-- follow-up", so no engine will ever generate a due date, a milestone or a
-- chase for it — which is what "optional, never mandatory" has to mean in a
-- system where every dated thing eventually becomes somebody's overdue item.

insert into services (name, category, mode, slot_based, day_offset, active)
select 'Initial Psychology Consultation', 'Counselling', 'Offline', false, null, true
where not exists (select 1 from services where name = 'Initial Psychology Consultation');


-- ---- 3. Take the real bloodwork off the test record -------------------------
--
-- Test Client 1's doctor consultation carries a real August 2024 blood panel —
-- yours. It is driving live clinical flags, and anyone opening that record sees
-- what looks like a patient's results.
--
-- Rather than blanking the fields (which would leave a consultation that reads
-- as though nothing was investigated), the figures are replaced with the ones
-- from sample-blood-report.pdf, the synthetic file already attached to this
-- client. The record stays internally consistent: the intake answers, the
-- uploaded report and the flags all now describe the same fictional panel.
--
-- Replacement is done on whole phrases, not bare numbers — "109" alone appears
-- in plenty of innocent places.

update consultations
   set answers = (
         replace(
         replace(
         replace(
         replace(
         replace(
         replace(
         replace(
         replace(
           answers::text,
           '109 (Aug 2024) — impaired fasting glucose range; repeat requested.',
           '112 (Jul 2026) — impaired fasting glucose range; repeat requested.'),
           '36 (Aug 2024) — low, below the 40 threshold.',
           '38 (Jul 2026) — low, below the 40 threshold.'),
           '174 (Aug 2024) — desirable.',
           '214 (Jul 2026) — above the desirable range.'),
           '102 (Aug 2024) — normal.',
           '186 (Jul 2026) — raised.'),
           '46 (Aug 2024) — raised above the adult reference of <35; repeat with LFT.',
           '34 (Jul 2026) — normal. ALT 61 U/L raised; repeat with LFT.'),
           '21 (Aug 2024) — normal.',
           '61 (Jul 2026) — raised above the adult reference.'),
           'Fasting glucose 109 mg/dL on the 2024 panel — impaired fasting glucose range.',
           'Fasting glucose 112 mg/dL on the Jul 2026 panel — impaired fasting glucose range.'),
           'Aug 2024',
           'Jul 2026'
         )::jsonb
       ),
       -- The two flags were derived from the real numbers, so they carry them too.
       flags = '[
         {"text": "Fasting glucose 112 mg/dL — impaired fasting glucose", "severity": "warning"},
         {"text": "HDL 38 mg/dL — below the 40 mg/dL reference", "severity": "warning"}
       ]'::jsonb,
       summary = replace(replace(summary, 'Aug 2024', 'Jul 2026'), '(DDRC)', '(sample report)')
 where id = 'b3214ae4-e159-455b-81b4-13f381de02bb';


-- ---- verification ----------------------------------------------------------
-- All three should come back changed:
--
--   select status, shared_at from diet_plans
--    where client_id = '2193690d-6b30-480f-b67d-87c4d85890b3';
--
--   select name, category, day_offset from services where category = 'Counselling';
--
--   select flags from consultations where id = 'b3214ae4-e159-455b-81b4-13f381de02bb';
--
-- And this should return zero rows — no 2024 figures left anywhere on it:
--
--   select id from consultations
--    where id = 'b3214ae4-e159-455b-81b4-13f381de02bb'
--      and (answers::text like '%Aug 2024%' or summary like '%Aug 2024%');
