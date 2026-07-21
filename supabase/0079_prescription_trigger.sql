-- ============================================================================
-- Cureocity — the prescription trigger. Run after 0078.
--
-- The 24h "prescription reaches the client portal" clock can only run when the
-- system knows a prescription was actually needed. Without an explicit signal
-- there is no way to tell "this client didn't need one" from "the doctor
-- forgot" — and a clock that can't tell those apart either flags every healthy
-- client as overdue, or flags nobody and catches nothing.
--
-- So the doctor answers on their consultation summary. A recorded "no" is a
-- fact. An absence is not.
--
-- NULL is deliberately a third state: "not answered yet". It means an older
-- consultation, or one completed before this shipped, reads as unknown rather
-- than as a silent "no".
-- ============================================================================

begin;

alter table consultations add column if not exists prescription_needed boolean;

comment on column consultations.prescription_needed is
  'Doctor''s answer on the consult summary. true starts the 24h prescription '
  'delivery clock; false records that none was required; null = not answered.';

-- The sweep asks "doctor said yes, is it delivered?" every night.
create index if not exists consultations_rx_needed_idx
  on consultations (client_id, completed_at)
  where prescription_needed = true;

commit;

-- Verify:
--   select kind, prescription_needed, count(*) from consultations
--    group by 1,2 order by 1,2;
