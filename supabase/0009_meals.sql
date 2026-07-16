-- ============================================================================
-- Cureocity — dietitian meal-monitoring follow-ups.
-- Run after 0006 (SQL Editor -> New query -> paste -> Run).
--
-- Per client, per day, per meal: the client logs what they ate + can ask a
-- question; the dietitian reviews, nudges missing meals, and answers questions.
-- ============================================================================

create table if not exists meal_logs (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade,
  date         date not null,
  meal         text not null,        -- breakfast | lunch | snack | dinner
  description  text,                 -- what the client ate
  review       text,                 -- dietitian feedback
  doubt        text,                 -- client question
  doubt_answer text,                 -- dietitian answer
  nudged       boolean not null default false,
  updated_at   timestamptz not null default now(),
  unique (client_id, date, meal)
);
create index if not exists meal_logs_client_date_idx on meal_logs (client_id, date);

alter table meal_logs enable row level security;

drop policy if exists meals_staff         on meal_logs;
drop policy if exists meals_client_read   on meal_logs;
drop policy if exists meals_client_write  on meal_logs;
drop policy if exists meals_client_update on meal_logs;

create policy meals_staff         on meal_logs for all    using (is_staff()) with check (is_staff());
create policy meals_client_read   on meal_logs for select using (client_id = my_client_id());
create policy meals_client_write  on meal_logs for insert with check (client_id = my_client_id());
create policy meals_client_update on meal_logs for update using (client_id = my_client_id()) with check (client_id = my_client_id());
