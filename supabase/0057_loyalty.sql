-- ============================================================================
-- Cureocity — loyalty points program for the Retention hub. Run after 0056.
-- ============================================================================

create table if not exists loyalty (
  client_id  uuid primary key references clients(id) on delete cascade,
  points     int not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table loyalty enable row level security;
drop policy if exists loyalty_staff on loyalty;
create policy loyalty_staff on loyalty for all using (is_staff()) with check (is_staff());
drop policy if exists loyalty_client_read on loyalty;
create policy loyalty_client_read on loyalty for select using (client_id = my_client_id());

alter publication supabase_realtime add table loyalty;
