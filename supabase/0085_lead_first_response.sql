-- ============================================================================
-- Cureocity — first response to a new lead. Run after 0084.
--
-- Two gaps close here:
--
--  1. `leads` has no email column. LEAD_FIELDS (lib/actions.ts) carries phone
--     and nothing else contactable, so no automated message could ever reach a
--     lead — which is why tplWelcome has existed since the email module landed
--     without a single caller.
--
--  2. `tasks.client_id` references clients(id). A task about a LEAD cannot be
--     stored, for exactly the reason the SLA ledger couldn't in 0084: a lead is
--     not a client. Adding lead_id with an XOR check keeps both kinds in one
--     queue without weakening either foreign key.
-- ============================================================================

begin;

-- ---- 1. an address to write to --------------------------------------------
alter table leads add column if not exists email text;

comment on column leads.email is
  'Optional. Phone is the primary channel for this business; email is captured '
  'when offered and is what the welcome message needs.';

create index if not exists leads_email_idx on leads (lower(email)) where email is not null;

-- ---- 2. tasks that belong to a lead ---------------------------------------
alter table tasks add column if not exists lead_id uuid references leads(id) on delete cascade;

-- Same XOR shape as appointments/sessions (0080) and messages (0082): a row
-- belongs to a lead or a client, never both, and may belong to neither (a
-- general ops task). Existing rows are unaffected.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_subject_chk') then
    alter table tasks add constraint tasks_subject_chk
      check (not (client_id is not null and lead_id is not null));
  end if;
end $$;

create index if not exists tasks_lead_idx on tasks (lead_id) where lead_id is not null;

commit;

-- Verify:
--   select count(*) from leads where email is not null;
--   select conname from pg_constraint where conname = 'tasks_subject_chk';
--   select lead_id, client_id, title from tasks where lead_id is not null limit 10;
