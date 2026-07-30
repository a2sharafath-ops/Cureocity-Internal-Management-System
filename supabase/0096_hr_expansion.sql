-- ============================================================================
-- Cureocity — HR expansion: leave types, holiday calendar, per-employee
-- documents (onboarding forms / certificates) + salary breakup. Run after 0095.
-- Monthly attendance uses the existing `attendance` table (queried by range).
-- Leave balances are computed live (entitlement − approved days), so no balance
-- table is needed.
-- ============================================================================

-- ---- leave types (CL / SL / EL / ML / PL) -----------------------------------
create table if not exists leave_types (
  code        text primary key,                 -- CL | SL | EL | ML | PL | LOP
  name        text not null,
  annual_days int  not null default 0,          -- yearly entitlement (editable)
  paid        boolean not null default true,
  active      boolean not null default true,
  seq         int not null default 0,
  color       text
);
insert into leave_types (code, name, annual_days, paid, seq, color) values
  ('CL', 'Casual Leave',     12,  true, 1, '#2563eb'),
  ('SL', 'Sick Leave',       12,  true, 2, '#dc2626'),
  ('EL', 'Earned Leave',     15,  true, 3, '#16a34a'),
  ('ML', 'Maternity Leave', 182,  true, 4, '#db2777'),
  ('PL', 'Paternity Leave',  15,  true, 5, '#7c3aed'),
  ('LOP','Loss of Pay',       0, false, 6, '#6b7280')
on conflict (code) do nothing;

-- ---- holiday calendar -------------------------------------------------------
create table if not exists holidays (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  name       text not null,
  kind       text not null default 'Public',    -- Public | Restricted | Optional
  created_by text,
  created_at timestamptz not null default now(),
  unique (date, name)
);
create index if not exists holidays_date_idx on holidays (date);

-- ---- per-employee documents (files live in the hr-files bucket) --------------
create table if not exists employee_documents (
  id          uuid primary key default gen_random_uuid(),
  staff_id    text references staff(id) on delete cascade,
  title       text not null,
  kind        text not null default 'Document',  -- Onboarding form | Certificate | ID proof | Contract | Other
  bucket      text not null default 'hr-files',
  path        text not null,
  name        text,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists employee_documents_staff_idx on employee_documents (staff_id);

-- ---- salary breakup (one structure per employee) ----------------------------
create table if not exists salary_structures (
  staff_id       text primary key references staff(id) on delete cascade,
  basic          numeric not null default 0,
  hra            numeric not null default 0,
  allowances     numeric not null default 0,     -- other/special allowances
  pf             numeric not null default 0,
  esi            numeric not null default 0,
  pt             numeric not null default 0,      -- professional tax
  tds            numeric not null default 0,
  effective_from date,
  updated_by     text,
  updated_at     timestamptz not null default now()
);

-- ---- RLS: staff-only, same as the rest of HR --------------------------------
do $$ declare t text;
begin
  foreach t in array array['leave_types','holidays','employee_documents','salary_structures']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_staff on %I', t, t);
    execute format('create policy %I_staff on %I for all using (is_staff()) with check (is_staff())', t, t);
    begin execute format('alter publication supabase_realtime add table %I', t); exception when others then null; end;
  end loop;
end $$;

-- ---- private storage bucket for HR documents --------------------------------
insert into storage.buckets (id, name, public)
values ('hr-files', 'hr-files', false)
on conflict (id) do nothing;

drop policy if exists hr_files_staff on storage.objects;
create policy hr_files_staff on storage.objects for all
  using (bucket_id = 'hr-files' and is_staff())
  with check (bucket_id = 'hr-files' and is_staff());
