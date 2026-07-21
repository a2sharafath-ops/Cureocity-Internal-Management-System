-- ============================================================================
-- Cureocity — pipeline value, disqualification, and lead-linked activity.
-- Run after 0081.
--
-- Three gaps, all structural rather than cosmetic:
--
--  1. DISQUALIFIED is not LOST. `LOST` currently means both "we lost the deal
--     at close" and "wrong number, never reachable". The sales audit found
--     28.5% of unconverted leads were unreachable — folding those into LOST
--     understates every conversion rate, because the denominator includes
--     people who were never really leads.
--
--  2. No amount ever reaches a lead. `leads.budget` sounds like money but holds
--     sentiment — "asks price immediately", "doesn't ask price first". Without
--     a number there is no forecast, which is why Sales Targets can only ever
--     look backwards.
--
--  3. `email_log` and `messages` are client-only. A pre-sale conversation has
--     nowhere to live, so a lead activity timeline cannot be assembled even if
--     someone wrote the UI.
-- ============================================================================

begin;

-- ---- 1. disqualification ---------------------------------------------------
-- A separate boolean rather than a stage value, because a lead can be
-- disqualified from any stage and we want to keep the stage it died in — that
-- is exactly the leak-point data the audit asks for.
alter table leads add column if not exists disqualified_at     timestamptz;
alter table leads add column if not exists disqualified_reason text;
alter table leads add column if not exists disqualified_by     text;

comment on column leads.disqualified_reason is
  'Why this was never a real opportunity: unreachable | wrong_number | duplicate '
  '| out_of_area | not_our_service | spam. Distinct from LOST, which means we '
  'competed and lost.';

create index if not exists leads_disqualified_idx
  on leads (disqualified_at) where disqualified_at is not null;

-- ---- 2. the light opportunity ---------------------------------------------
-- Not Salesforce's object. Salesforce models negotiated B2B deals with many
-- stakeholders; Cureocity sells a fixed catalogue at published prices to
-- individuals. Three fields give weighted pipeline at a fraction of the cost.
alter table leads add column if not exists expected_package_id text references packages(id);
alter table leads add column if not exists expected_value      numeric(12,2);
alter table leads add column if not exists expected_close      date;

comment on column leads.expected_value is
  'Rupees this lead is expected to be worth. Defaults from the chosen package '
  'price but is overridable — discounts and part-payments are real.';

create index if not exists leads_expected_close_idx
  on leads (expected_close) where expected_close is not null;

-- Stored score and tier. They were computed at render and thrown away, so you
-- could not filter on them in SQL, sort by them, or ask "who moved from COLD
-- to HOT last week". Written by the app whenever a lead changes.
alter table leads add column if not exists score      int;
alter table leads add column if not exists tier       text;
alter table leads add column if not exists scored_at  timestamptz;

create index if not exists leads_tier_idx on leads (tier) where tier is not null;

-- ---- 3. lead-linked activity ----------------------------------------------
-- Same XOR shape as appointments/sessions in 0080: a row belongs to a lead or
-- a client, never both. Existing rows all carry client_id, so the constraint
-- is satisfiable immediately.
alter table email_log add column if not exists lead_id uuid references leads(id) on delete set null;
create index if not exists email_log_lead_idx on email_log (lead_id);

alter table messages add column if not exists lead_id uuid references leads(id) on delete cascade;
alter table messages alter column client_id drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_owner_chk') then
    alter table messages add constraint messages_owner_chk
      check ((client_id is not null) <> (lead_id is not null));
  end if;
end $$;

create index if not exists messages_lead_idx on messages (lead_id);

-- Staff can read pre-sale messages; the client policy is unchanged and still
-- keyed on client_id, so a lead's messages are invisible to every portal user.
drop policy if exists messages_staff_lead on messages;
create policy messages_staff_lead on messages
  for all using (is_staff() and lead_id is not null)
  with check (is_staff() and lead_id is not null);

commit;

-- Verify:
--   select count(*) from leads where disqualified_at is not null;
--   select tier, count(*), sum(expected_value) from leads group by tier;
--   select conname from pg_constraint where conname = 'messages_owner_chk';
