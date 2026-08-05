-- ============================================================================
-- Cureocity — compensatory leave + staff roster. Run after 0123.
--
-- COMP-OFF. A restricted holiday can only be granted to some of the team; the
-- ones who work it are owed the day back. That debt lived in someone's head.
-- It is a ledger, not a balance column: each credit records what earned it and
-- when it lapses, so "why do I have 3?" always has an answer.
--
-- ROSTER. Who is on the floor, per day, per discipline. Shifts are named
-- templates so a week can be filled in a few clicks and read at a glance.
-- ============================================================================

-- ---- 1. comp-off credits ---------------------------------------------------
create table if not exists comp_offs (
  id          uuid primary key default gen_random_uuid(),
  staff_id    text not null references staff(id) on delete cascade,
  -- The day that earned it: a holiday worked, or a restricted leave refused.
  earned_on   date not null,
  reason      text not null,
  -- 90 days to use it. Set at grant time rather than computed on read, so
  -- changing the policy later cannot silently expire credits already given.
  expires_on  date not null,
  -- available → used (consumed by a leave) | expired (swept) | cancelled
  status      text not null default 'available'
              check (status in ('available', 'used', 'expired', 'cancelled')),
  used_leave  uuid references leaves(id) on delete set null,
  used_on     date,
  granted_by  text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists comp_offs_staff_idx  on comp_offs (staff_id, status);
create index if not exists comp_offs_expiry_idx on comp_offs (expires_on) where status = 'available';

alter table comp_offs enable row level security;
drop policy if exists comp_offs_read  on comp_offs;
drop policy if exists comp_offs_write on comp_offs;
-- Staff may see their own credits; HR/Manager/Admin see everyone's.
create policy comp_offs_read on comp_offs for select
  using (
    my_role() in ('Administrator', 'Super Admin', 'Manager', 'HR')
    or staff_id = (select staff_id from profiles where id = auth.uid())
  );
create policy comp_offs_write on comp_offs for all
  using (my_role() in ('Administrator', 'Super Admin', 'Manager', 'HR'))
  with check (my_role() in ('Administrator', 'Super Admin', 'Manager', 'HR'));

-- A comp-off is spent by booking leave against it.
insert into leave_types (code, name, annual_days, paid, active, seq, color, note, gender, min_tenure_months, accrual)
values ('COMP', 'Compensatory Off', 0, true, true, 9, '#0d9488',
        'Earned by working a holiday or week-off · 90 days to use', 'any', 0, 'annual')
on conflict (code) do update set
  name = excluded.name, paid = excluded.paid, active = excluded.active,
  color = excluded.color, note = excluded.note;

-- ---- 2. shift templates ----------------------------------------------------
create table if not exists shift_types (
  code       text primary key,               -- M | E | GEN | OFF | HALF
  name       text not null,
  start_time time,                           -- null for a non-working shift
  end_time   time,
  color      text,
  -- OFF and LEAVE are shifts you can assign but nobody works.
  working    boolean not null default true,
  active     boolean not null default true,
  seq        int not null default 0
);
insert into shift_types (code, name, start_time, end_time, color, working, seq) values
  ('M',    'Morning',   '07:00', '15:00', '#2563eb', true,  1),
  ('E',    'Evening',   '14:00', '22:00', '#7c3aed', true,  2),
  ('GEN',  'General',   '09:00', '18:00', '#16a34a', true,  3),
  ('HALF', 'Half day',  '09:00', '13:00', '#d97706', true,  4),
  ('OFF',  'Week off',   null,    null,   '#94a3b8', false, 5),
  ('LV',   'On leave',   null,    null,   '#dc2626', false, 6)
on conflict (code) do nothing;

-- ---- 3. the roster ---------------------------------------------------------
create table if not exists roster (
  id         uuid primary key default gen_random_uuid(),
  staff_id   text not null references staff(id) on delete cascade,
  date       date not null,
  shift      text not null references shift_types(code),
  -- Set only when someone works outside the template's hours; null means
  -- "the shift's own times", so changing a template updates every normal day.
  start_time time,
  end_time   time,
  branch     text,
  note       text,
  created_by text,
  updated_at timestamptz not null default now(),
  -- One shift per person per day. Re-assigning overwrites rather than stacking.
  unique (staff_id, date)
);
create index if not exists roster_date_idx  on roster (date);
create index if not exists roster_staff_idx on roster (staff_id, date);

alter table roster enable row level security;
drop policy if exists roster_read  on roster;
drop policy if exists roster_write on roster;
-- Everyone signed in can read the roster: knowing who is on the floor is how
-- you decide who to hand a walk-in to.
create policy roster_read on roster for select using (is_staff());
create policy roster_write on roster for all
  using (my_role() in ('Administrator', 'Super Admin', 'Manager', 'HR'))
  with check (my_role() in ('Administrator', 'Super Admin', 'Manager', 'HR'));

alter table shift_types enable row level security;
drop policy if exists shift_types_read  on shift_types;
drop policy if exists shift_types_write on shift_types;
create policy shift_types_read on shift_types for select using (is_staff());
create policy shift_types_write on shift_types for all
  using (my_role() in ('Administrator', 'Super Admin', 'Manager', 'HR'))
  with check (my_role() in ('Administrator', 'Super Admin', 'Manager', 'HR'));

do $$ begin execute 'alter publication supabase_realtime add table roster'; exception when others then null; end $$;
