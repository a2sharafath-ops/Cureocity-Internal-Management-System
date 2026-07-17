-- ============================================================================
-- Cureocity — HR: attendance, leave, payroll. Run after 0035 (SQL Editor).
-- Uses the existing staff table.
-- ============================================================================

create table if not exists attendance (
  id         uuid primary key default gen_random_uuid(),
  staff_id   text references staff(id) on delete cascade,
  date       date not null default current_date,
  status     text not null default 'present',   -- present | absent | leave | half
  marked_by  text,
  created_at timestamptz not null default now(),
  unique (staff_id, date)
);
create index if not exists attendance_date_idx on attendance (date);

create table if not exists leaves (
  id         uuid primary key default gen_random_uuid(),
  staff_id   text references staff(id) on delete cascade,
  from_date  date not null,
  to_date    date not null,
  type       text default 'Casual',              -- Casual | Sick | Earned | Unpaid
  reason     text,
  status     text not null default 'pending',    -- pending | approved | rejected
  decided_by text,
  created_at timestamptz not null default now()
);
create index if not exists leaves_staff_idx on leaves (staff_id);

create table if not exists payroll (
  id         uuid primary key default gen_random_uuid(),
  staff_id   text references staff(id) on delete cascade,
  month      text not null,                       -- 'YYYY-MM'
  base       numeric not null default 0,
  lop_days   int not null default 0,              -- loss-of-pay days
  net        numeric not null default 0,
  status     text not null default 'pending',     -- pending | paid
  paid_date  date,
  created_at timestamptz not null default now(),
  unique (staff_id, month)
);
create index if not exists payroll_month_idx on payroll (month);

alter table attendance enable row level security;
alter table leaves     enable row level security;
alter table payroll    enable row level security;
drop policy if exists attendance_staff on attendance;
drop policy if exists leaves_staff on leaves;
drop policy if exists payroll_staff on payroll;
create policy attendance_staff on attendance for all using (is_staff()) with check (is_staff());
create policy leaves_staff     on leaves     for all using (is_staff()) with check (is_staff());
create policy payroll_staff    on payroll    for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table attendance'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table leaves';     exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table payroll';    exception when others then null; end;
end $$;
