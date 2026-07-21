-- ============================================================================
-- Cureocity — lead remarks and next-follow-up dates. Run after 0080.
--
-- Two gaps this closes, both named in HOW CUREOCITY SELLS:
--
--  1. "Follow-up Date is filled only 17% of the time despite remarks saying
--     'call tomorrow'". In this app the field didn't exist at all — `followups`
--     is client-scoped with no lead_id, so a lead could never carry a callback
--     date. Now it can, and logging a remark is the moment you set it.
--
--  2. Remarks live in `leads.notes` as one growing free-text blob with dates
--     typed inside the string — "16/05/2026 call not connecting • 11/06/2026
--     not connecting". You cannot sort, filter or report on that. A remark is
--     an event with an author and a timestamp, so it gets a table.
--
-- `leads.notes` is NOT dropped. It holds the imported history for 999 leads and
-- rewriting that into rows would mean parsing dates out of prose written by
-- three different people over six months. It stays as the archive; new remarks
-- go to the table.
-- ============================================================================

begin;

-- ---- the remark log --------------------------------------------------------
create table if not exists lead_remarks (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  body       text not null,
  -- what happened, so the log can be filtered to real contact vs admin noise
  outcome    text,          -- reached | no_answer | not_interested | callback | note
  by_name    text,
  created_at timestamptz not null default now()
);

create index if not exists lead_remarks_lead_idx on lead_remarks (lead_id, created_at desc);

alter table lead_remarks enable row level security;
drop policy if exists lead_remarks_staff on lead_remarks;
create policy lead_remarks_staff on lead_remarks
  for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table lead_remarks'; exception when others then null; end;
end $$;

-- ---- the follow-up date ----------------------------------------------------
alter table leads add column if not exists next_follow_up      date;
alter table leads add column if not exists next_follow_up_note text;
-- Who owes the callback. Falls back to `fde` when unset; kept separate because
-- `fde` records who originally handled the lead, which isn't always who owes
-- the next call.
alter table leads add column if not exists follow_up_owner     text;

comment on column leads.next_follow_up is
  'Date the next callback is due. Set when a remark is logged. The nightly '
  'sweep notifies the owner when it arrives and escalates to management when '
  'it is missed.';

-- The nightly sweep asks "due on or before today, still open" every night.
create index if not exists leads_followup_due_idx
  on leads (next_follow_up)
  where next_follow_up is not null;

-- ---- date-wise search ------------------------------------------------------
-- The leads page can already filter by view/stage/tier/search; adding date
-- ranges means ordering by created_at needs to be cheap.
create index if not exists leads_created_idx on leads (created_at);

commit;

-- Verify:
--   select count(*) from lead_remarks;
--   select count(*) from leads where next_follow_up is not null;
