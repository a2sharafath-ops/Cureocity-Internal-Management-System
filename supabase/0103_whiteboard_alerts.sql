-- ============================================================================
-- Cureocity — Whiteboard alerts & daily reviews. Run after 0102 (SQL Editor).
--
-- The revised whiteboard is a mandatory daily walk through EVERY alive client,
-- one by one. For each MAJOR alert on a client (SLA breach, open concern,
-- overdue follow-up, critical/low BluePrint score) the assigned person must
-- record WHY it happened and the SOLUTION before it clears. `whiteboard_reviews`
-- marks a client as walked-through for the day so the board shows real progress.
-- ============================================================================

-- The "why + solution" the assigned person gives for one alert, on one day.
-- alert_key is stable per (client, alert type) e.g. "sla", "concern:<id>",
-- "followup:<id>", "score:<scoreKey>", so re-runs upsert instead of duplicate.
create table if not exists whiteboard_alert_responses (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references whiteboard_sessions(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  alert_key   text not null,                 -- sla | concern:<id> | followup:<id> | score:<key>
  alert_label text,                          -- human label captured at answer time
  discipline  text,                          -- who owns it: doctor|dietitian|trainer|coach|psych
  why         text,
  solution    text,
  resolved    boolean not null default false,
  answered_by text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (session_id, client_id, alert_key)
);
create index if not exists wb_alert_resp_session_idx on whiteboard_alert_responses (session_id);
create index if not exists wb_alert_resp_client_idx  on whiteboard_alert_responses (client_id);

-- One row per client per board day: they were walked through the whiteboard.
create table if not exists whiteboard_reviews (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references whiteboard_sessions(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  stage       text,                          -- green|yellow|orange|red|alarm at review time
  reviewed_by text,
  created_at  timestamptz not null default now(),
  unique (session_id, client_id)
);
create index if not exists wb_reviews_session_idx on whiteboard_reviews (session_id);

-- ---------------------------------------------------------------------------
-- RLS: shared clinical space — every staff member reads and contributes.
alter table whiteboard_alert_responses enable row level security;
alter table whiteboard_reviews         enable row level security;

drop policy if exists wb_alert_resp_staff on whiteboard_alert_responses;
drop policy if exists wb_reviews_staff     on whiteboard_reviews;

create policy wb_alert_resp_staff on whiteboard_alert_responses for all using (is_staff()) with check (is_staff());
create policy wb_reviews_staff     on whiteboard_reviews         for all using (is_staff()) with check (is_staff());

do $$ begin execute 'alter publication supabase_realtime add table whiteboard_alert_responses'; exception when others then null; end $$;
do $$ begin execute 'alter publication supabase_realtime add table whiteboard_reviews'; exception when others then null; end $$;
