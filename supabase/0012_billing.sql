-- ============================================================================
-- Cureocity — billing / invoices. Run after 0006 (SQL Editor -> Run).
-- ============================================================================

create table if not exists invoices (
  id          uuid primary key default gen_random_uuid(),
  num         int,
  client_id   uuid references clients(id) on delete set null,
  description text,
  amount      numeric not null default 0,
  status      text not null default 'Unpaid',   -- Unpaid | Paid | Refunded
  method      text,                              -- Cash | Card | UPI | Bank | Online
  issued_date date,
  paid_date   date,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists invoices_client_idx on invoices (client_id);
create index if not exists invoices_created_idx on invoices (created_at desc);

alter table invoices enable row level security;
drop policy if exists invoices_staff       on invoices;
drop policy if exists invoices_client_read on invoices;
create policy invoices_staff       on invoices for all    using (is_staff()) with check (is_staff());
create policy invoices_client_read on invoices for select using (client_id = my_client_id());

-- realtime
do $$ begin
  begin execute 'alter publication supabase_realtime add table invoices'; exception when others then null; end;
end $$;
