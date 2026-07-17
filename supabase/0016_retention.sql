-- ============================================================================
-- Cureocity — retention: NPS feedback + referrals. Run after 0015 (SQL Editor).
-- Churn / at-risk is COMPUTED from existing data (sessions, subscriptions,
-- invoices) — no table needed for it.
-- ============================================================================

-- ---- NPS / feedback --------------------------------------------------------
create table if not exists nps_responses (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  score       int not null,                    -- 0..10
  comment     text,
  channel     text default 'in-app',           -- in-app | email | phone | front-desk
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists nps_client_idx  on nps_responses (client_id);
create index if not exists nps_created_idx on nps_responses (created_at desc);

alter table nps_responses enable row level security;
drop policy if exists nps_staff        on nps_responses;
drop policy if exists nps_client_read  on nps_responses;
drop policy if exists nps_client_write on nps_responses;
create policy nps_staff        on nps_responses for all    using (is_staff()) with check (is_staff());
create policy nps_client_read  on nps_responses for select using (client_id = my_client_id());
create policy nps_client_write on nps_responses for insert with check (client_id = my_client_id());

-- ---- referrals -------------------------------------------------------------
create table if not exists referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid references clients(id) on delete set null,
  referred_name text not null,
  referred_phone text,
  referred_email text,
  status        text not null default 'invited',   -- invited | joined | rewarded
  reward_amount numeric not null default 0,
  note          text,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on referrals (referrer_id);
create index if not exists referrals_created_idx  on referrals (created_at desc);

alter table referrals enable row level security;
drop policy if exists referrals_staff       on referrals;
drop policy if exists referrals_client_read on referrals;
create policy referrals_staff       on referrals for all    using (is_staff()) with check (is_staff());
create policy referrals_client_read on referrals for select using (referrer_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table nps_responses'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table referrals';     exception when others then null; end;
end $$;
