-- ============================================================================
-- Cureocity — a once-only ledger for automation that isn't about a client.
-- Run after 0083.
--
-- WHY THIS EXISTS (and a bug it fixes)
--
-- `blueprint_sla_events` is the idempotency ledger that stops the nightly
-- sweeps re-notifying. Its key column is:
--
--     client_id uuid not null references clients(id) on delete cascade
--
-- 0078 generalised it with a `protocol` column so BluePrint and Comprehensive
-- could share it — both of which really are about a client, so the foreign key
-- held.
--
-- The lead callback sweep (lib/cron/lead-followups.ts) then reused the same
-- table and wrote LEAD ids into `client_id`. No lead id exists in `clients`, so
-- that insert violates the foreign key and throws. It has never been observed
-- because the sweep's WHERE clause requires `next_follow_up IS NOT NULL`, and
-- at the time of writing not one of 999 leads had a callback date — so the
-- function always returned before reaching the insert. The moment somebody set
-- a callback date, the nightly cron would have started failing.
--
-- Rather than weaken the FK on a clinical table, automation about anything
-- other than a client gets its own ledger. `subject_id` is deliberately text
-- and deliberately unconstrained: it holds a lead id today and a staff id for
-- the coverage digest, and neither is a client.
-- ============================================================================

begin;

create table if not exists automation_events (
  id          uuid primary key default gen_random_uuid(),
  -- lead id, staff id, or whatever the sweep is keyed on. No FK by design:
  -- this table spans subject types.
  subject_id  text not null,
  subject_kind text not null,          -- 'lead' | 'staff'
  protocol    text not null,           -- which sweep wrote this
  gate        text not null,           -- the specific checkpoint, may embed a date
  kind        text not null,           -- warning | breach | digest | reminder
  due_at      timestamptz,
  noticed_at  timestamptz not null default now()
);

-- The idempotency guarantee. A sweep checks for the row before notifying and
-- upserts after, so a re-run within the same window is a no-op.
create unique index if not exists automation_events_key
  on automation_events (subject_id, protocol, gate, kind);

create index if not exists automation_events_subject_idx
  on automation_events (subject_kind, subject_id);

-- Housekeeping: gates that embed a date accumulate one row per subject per day.
create index if not exists automation_events_noticed_idx
  on automation_events (noticed_at);

alter table automation_events enable row level security;
drop policy if exists automation_events_staff on automation_events;
create policy automation_events_staff on automation_events
  for all using (is_staff()) with check (is_staff());

commit;

-- Verify:
--   select protocol, kind, count(*) from automation_events group by 1,2;
--   select * from automation_events order by noticed_at desc limit 20;
