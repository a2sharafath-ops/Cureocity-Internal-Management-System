-- ============================================================================
-- Cureocity — BluePrint delivery SLA. Run after 0076 (SQL Editor).
--
-- The BluePrint journey has hard turnaround commitments:
--   • each clinician approves their own summary within 24h of their
--     appointment completing;
--   • the consolidated summary and blueprint approval land within 48h of the
--     LAST of the three appointments completing.
--
-- None of this could be measured before, because every approval in the chain
-- was a bare boolean — `consultations.approved`, `blueprints.generated`. You
-- could see *that* something was approved, never *when*, so "late" was not a
-- computable question. This migration adds the clocks.
--
-- Deliberately additive: no column is dropped or renamed, every new column is
-- nullable, and existing rows backfill from `audit_log` where possible (see
-- the backfill block at the bottom). Nothing here changes current behaviour on
-- its own — the app has to start writing the timestamps.
-- ============================================================================

-- ---- consultations: when did it finish, when was it signed off -------------
alter table consultations add column if not exists completed_at timestamptz;
alter table consultations add column if not exists approved_at  timestamptz;
alter table consultations add column if not exists approved_by  text;

comment on column consultations.completed_at is
  'Starts the 24h sign-off clock for this clinician. Set when status -> completed.';
comment on column consultations.approved_at is
  'Stops the 24h clock. Null while status=completed means the clock is running.';

-- The SLA sweep asks "completed but not yet approved" constantly.
create index if not exists consultations_sla_idx
  on consultations (completed_at)
  where approved_at is null;

-- ---- blueprints: the consolidated + approval clocks ------------------------
alter table blueprints add column if not exists consolidated_at timestamptz;
alter table blueprints add column if not exists approved        boolean not null default false;
alter table blueprints add column if not exists approved_at     timestamptz;
alter table blueprints add column if not exists approved_by     text;

-- `status` documented in_progress | consolidated | generated since 0005, but
-- nothing ever wrote 'consolidated' — generateBlueprint jumped straight to
-- 'generated'. The two are now distinct states with their own timestamps:
--   in_progress  -> awaiting the three sign-offs
--   consolidated -> summary written, awaiting blueprint approval
--   generated    -> approved and delivered to the client
comment on column blueprints.approved is
  'Blueprint approval — the final gate, distinct from consolidated summary written.';

-- ---- client-side hold ------------------------------------------------------
-- "unless there is a delay from the client side". A rescheduled appointment or
-- an unreachable client should not burn the team's SLA. Same shape as the
-- package freeze in 0075: an open hold (hold_since set) plus banked elapsed
-- time, so the clock resumes rather than resets.
alter table blueprints add column if not exists hold_since timestamptz;
alter table blueprints add column if not exists hold_ms    bigint not null default 0;
alter table blueprints add column if not exists hold_note  text;

comment on column blueprints.hold_since is
  'Non-null = clocks paused now. hold_ms banks time from previously closed holds.';

-- ---- SLA breach ledger -----------------------------------------------------
-- One row per (client, gate, kind) so the nightly sweep is idempotent: the
-- unique constraint is what stops a breached blueprint notifying the same
-- manager every single night forever. Same trick email_log plays for reminders.
create table if not exists blueprint_sla_events (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  gate       text not null,           -- signoff:Doctor | signoff:Diet | signoff:Trainer | consolidated
  kind       text not null,           -- warning | breach
  due_at     timestamptz not null,
  noticed_at timestamptz not null default now(),
  unique (client_id, gate, kind)
);

create index if not exists blueprint_sla_events_client_idx
  on blueprint_sla_events (client_id);

alter table blueprint_sla_events enable row level security;
drop policy if exists bp_sla_staff on blueprint_sla_events;
create policy bp_sla_staff on blueprint_sla_events
  for all using (is_staff()) with check (is_staff());

-- ---- backfill --------------------------------------------------------------
-- Existing completed consultations have no completed_at, which would make them
-- look like they never started the clock. Fall back to created_at: imprecise,
-- but it stops historical rows reading as "in progress forever". Rows already
-- approved get approved_at set to the same value so they read as met, not
-- breached — we genuinely don't know when they were approved, and inventing a
-- breach for past work would be worse than admitting ignorance.
update consultations
   set completed_at = coalesce(completed_at, created_at)
 where status = 'completed' and completed_at is null;

update consultations
   set approved_at = coalesce(approved_at, completed_at)
 where approved = true and approved_at is null;

-- Blueprints already generated are, by definition, past every gate.
update blueprints
   set approved    = true,
       approved_at = coalesce(approved_at, updated_at),
       consolidated_at = coalesce(consolidated_at, updated_at)
 where generated = true and approved = false;

-- Verify:
--   select status, count(*), count(completed_at), count(approved_at)
--     from consultations group by status;
--   select status, generated, approved, count(*) from blueprints
--    group by 1,2,3;
