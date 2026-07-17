-- ============================================================================
-- Cureocity — monthly sales targets. Run after 0030 (SQL Editor).
-- Admin sets monthly goals; front desk sees live progress.
-- ============================================================================

create table if not exists sales_targets (
  id                 uuid primary key default gen_random_uuid(),
  month              text not null unique,      -- 'YYYY-MM'
  revenue_target     numeric not null default 0,
  new_clients_target int not null default 0,
  renewals_target    int not null default 0,
  set_by             text,
  updated_at         timestamptz not null default now()
);

alter table sales_targets enable row level security;
drop policy if exists targets_staff on sales_targets;
create policy targets_staff on sales_targets for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table sales_targets'; exception when others then null; end;
end $$;
