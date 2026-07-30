-- ============================================================================
-- Cureocity — store the daily meal summary (one per client per day). Generated
-- by AI or written by hand, saved here so it's kept on record (and can later be
-- surfaced/sent to the client). Run after 0100.
-- ============================================================================

create table if not exists meal_day_summaries (
  client_id   uuid not null references clients(id) on delete cascade,
  date        date not null,
  summary     text,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  sent_at     timestamptz,                 -- set when/if it's sent to the client (step C)
  primary key (client_id, date)
);

alter table meal_day_summaries enable row level security;
drop policy if exists meal_day_summaries_staff on meal_day_summaries;
create policy meal_day_summaries_staff on meal_day_summaries for all using (is_staff()) with check (is_staff());
drop policy if exists meal_day_summaries_client_read on meal_day_summaries;
create policy meal_day_summaries_client_read on meal_day_summaries for select using (client_id = my_client_id());
do $$ begin execute 'alter publication supabase_realtime add table meal_day_summaries'; exception when others then null; end $$;
