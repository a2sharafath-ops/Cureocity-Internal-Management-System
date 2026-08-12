-- ============================================================================
-- Cureocity — Health Coach 360 phase 3: baseline + screening provenance.
-- Run after 0166.
--
-- The baseline is a versioned, structured assessment. Validated screening
-- results retain the exact instrument/version/source and human follow-up so a
-- number is never detached from how it was obtained.
-- ============================================================================

begin;

create table if not exists coach_baselines (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null unique references clients(id) on delete cascade,
  version             text not null default 'Cureocity HC360 baseline v1.0',
  status              text not null default 'Draft' check (status in ('Draft', 'Completed', 'Reopened')),
  answers             jsonb not null default '{}'::jsonb,
  triggered_pathways  text[] not null default '{}',
  completion_percent  smallint not null default 0 check (completion_percent between 0 and 100),
  created_by           uuid not null default auth.uid(),
  creator_name         text not null,
  completed_by         uuid,
  completed_by_name    text,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (status <> 'Completed' or (completion_percent = 100 and completed_at is not null))
);

create index if not exists coach_baselines_status_idx
  on coach_baselines (status, updated_at desc);

create table if not exists coach_baseline_events (
  id          uuid primary key default gen_random_uuid(),
  baseline_id uuid not null references coach_baselines(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  event_type  text not null check (event_type in ('Started', 'Saved', 'Completed', 'Reopened')),
  percent     smallint not null check (percent between 0 and 100),
  pathways    text[] not null default '{}',
  actor_id    uuid not null default auth.uid(),
  actor_name  text not null,
  actor_role  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists coach_baseline_events_client_idx
  on coach_baseline_events (client_id, created_at desc);

alter table coach_assessments
  add column if not exists instrument text,
  add column if not exists instrument_version text,
  add column if not exists source_url text,
  add column if not exists administration_mode text,
  add column if not exists interpretation text,
  add column if not exists recommended_action text,
  add column if not exists reviewer_id uuid,
  add column if not exists reviewer_name text,
  add column if not exists next_review_date date,
  add column if not exists safety_event_id uuid references safety_events(id) on delete set null;

update coach_assessments
set instrument = coalesce(instrument, marker),
    instrument_version = coalesce(instrument_version, 'Legacy / not recorded'),
    administration_mode = coalesce(administration_mode, 'Legacy'),
    interpretation = coalesce(interpretation, band),
    reviewer_name = coalesce(reviewer_name, assessed_by)
where instrument is null
   or instrument_version is null
   or administration_mode is null
   or reviewer_name is null;

alter table coach_assessments drop constraint if exists coach_assessments_mode_check;
alter table coach_assessments add constraint coach_assessments_mode_check
  check (administration_mode is null or administration_mode in (
    'Embedded official form', 'Official external form', 'Manual verified result', 'Legacy'
  ));

create index if not exists coach_assessments_instrument_idx
  on coach_assessments (client_id, instrument, date desc);

alter table coach_baselines      enable row level security;
alter table coach_baseline_events enable row level security;

drop policy if exists coach_baselines_read on coach_baselines;
drop policy if exists coach_baselines_write on coach_baselines;
create policy coach_baselines_read on coach_baselines for select using (is_staff());
create policy coach_baselines_write on coach_baselines for all
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');

drop policy if exists coach_baseline_events_read on coach_baseline_events;
drop policy if exists coach_baseline_events_insert on coach_baseline_events;
create policy coach_baseline_events_read on coach_baseline_events for select using (is_staff());
create policy coach_baseline_events_insert on coach_baseline_events for insert
  with check (actor_id = auth.uid() and (is_admin() or my_role() = 'Health Coach'));
-- Baseline history is append-only.

-- Phase 1 established that coaching behaviour records are coach-owned. Bring
-- the older assessment table under the same boundary; all staff may still read.
drop policy if exists coach_assessments_staff on coach_assessments;
drop policy if exists coach_assessments_read on coach_assessments;
drop policy if exists coach_assessments_write on coach_assessments;
create policy coach_assessments_read on coach_assessments for select using (is_staff());
create policy coach_assessments_write on coach_assessments for all
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');

do $$ begin
  begin execute 'alter publication supabase_realtime add table coach_baselines'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table coach_baseline_events'; exception when others then null; end;
end $$;

commit;
