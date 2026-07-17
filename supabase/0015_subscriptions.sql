-- ============================================================================
-- Cureocity — subscriptions / recurring billing. Run after 0012 (SQL Editor).
-- ============================================================================

create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete cascade,
  package_id    text references packages(id),
  amount        numeric not null default 0,
  interval_days int not null default 30,
  status        text not null default 'active',   -- active | paused | cancelled
  auto_renew    boolean not null default true,
  start_date    date,
  renews_on     date,
  created_at    timestamptz not null default now()
);
create index if not exists subscriptions_client_idx on subscriptions (client_id);
create index if not exists subscriptions_renews_idx on subscriptions (renews_on);

alter table subscriptions enable row level security;
drop policy if exists subs_staff       on subscriptions;
drop policy if exists subs_client_read on subscriptions;
create policy subs_staff       on subscriptions for all    using (is_staff()) with check (is_staff());
create policy subs_client_read on subscriptions for select using (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table subscriptions'; exception when others then null; end;
end $$;
