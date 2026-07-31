-- ============================================================================
-- Cureocity — Health-Coach marker assessments. Run after 0109.
--
-- The coach tracks six markers per client (stress, sleep, activity, nutrition,
-- substance, anxiety) using validated tools on a set cadence. Each recorded
-- score is one row; the latest per (client, marker) drives the coaching board.
-- ============================================================================

create table if not exists coach_assessments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  marker      text not null,   -- stress | sleep | activity | nutrition | substance | anxiety
  score       numeric,
  band        text,            -- Low | Moderate | High | Good | Poor | Refer | …
  tone        text,            -- good | warn | bad
  note        text,
  assessed_by text,
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists coach_assessments_client_idx on coach_assessments (client_id, marker, date desc);

alter table coach_assessments enable row level security;
drop policy if exists coach_assessments_staff on coach_assessments;
create policy coach_assessments_staff on coach_assessments for all using (is_staff()) with check (is_staff());
do $$ begin execute 'alter publication supabase_realtime add table coach_assessments'; exception when others then null; end $$;
