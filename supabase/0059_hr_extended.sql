-- ============================================================================
-- Cureocity — HR suite: daily updates, leave balances, month-end verification,
-- payroll PF + payslips, commissions, statutory records, recruitment, HR docs,
-- purchase list, and offboarding. Run after 0058.
-- ============================================================================

alter table staff     add column if not exists leave_balance int default 12;
alter table payroll   add column if not exists pf       numeric not null default 1800;
alter table payroll   add column if not exists payslip  boolean not null default false;
alter table onboarding add column if not exists kind    text not null default 'onboarding';  -- onboarding | offboarding

create table if not exists hr_updates (
  id uuid primary key default gen_random_uuid(),
  author text, body text not null, created_at timestamptz not null default now()
);
create table if not exists hr_month_tasks (
  id uuid primary key default gen_random_uuid(),
  month text not null, seq int not null default 0, label text not null,
  status text not null default 'pending',        -- pending | done
  detail text
);
create table if not exists hr_commissions (
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text default 'Commission', amount numeric not null default 0, tds numeric default 0, note text,
  created_at timestamptz not null default now()
);
create table if not exists hr_statutory (
  id uuid primary key default gen_random_uuid(),
  name text not null, period text, status text not null default 'in_progress',  -- in_progress | prepared | filed
  due_note text
);
create table if not exists hr_candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null, role text, source text, stage text not null default 'Screening',  -- Screening | Interview | Offer sent | Hired
  created_at timestamptz not null default now()
);
create table if not exists hr_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null, kind text, person text, doc_date date, status text default 'ready'
);
create table if not exists hr_purchases (
  id uuid primary key default gen_random_uuid(),
  item text not null, requested_by text, req_date date, status text not null default 'requested'  -- requested | ordered | delivered
);

do $$ declare t text;
begin
  foreach t in array array['hr_updates','hr_month_tasks','hr_commissions','hr_statutory','hr_candidates','hr_documents','hr_purchases']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_staff on %I', t, t);
    execute format('create policy %I_staff on %I for all using (is_staff()) with check (is_staff())', t, t);
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;

-- ---- seed --------------------------------------------------------------------
insert into hr_updates (author, body) values
  ('Sinimol Antony', 'Front desk shift swapped with Rodic for Saturday.'),
  ('Babith T', 'Gym floor AC service visit at 3 PM today.'),
  ('Sharafath', 'Month-end verification starts on the 26th — submit leave records before then.')
on conflict do nothing;

insert into hr_month_tasks (month, seq, label, status, detail)
select to_char(current_date, 'YYYY-MM'), s, l, st, d from (values
  (1, 'Attendance sheet reconciled', 'done', 'Done'),
  (2, 'Leave balances updated', 'done', 'Done'),
  (3, 'LOPs computed', 'done', '3 LOP days across 2 staff'),
  (4, 'Payroll inputs handed to accounts', 'pending', null)
) v(s, l, st, d)
where not exists (select 1 from hr_month_tasks where month = to_char(current_date, 'YYYY-MM'));

insert into hr_commissions (name, kind, amount, tds) values
  ('Babith T', 'Training commission', 4200, 420),
  ('Sinimol Antony', 'Sales commission', 2800, 280),
  ('Annakutty', 'Training commission', 3600, 360)
on conflict do nothing;

insert into hr_statutory (name, period, status, due_note) values
  ('PF Sheet — July', 'July', 'prepared', 'by Jul 3–4'),
  ('ESI Sheet — July', 'July', 'in_progress', 'by Jul 3–4')
on conflict do nothing;

insert into hr_candidates (name, role, source, stage) values
  ('Anjali R', 'Client Associate', 'Indeed', 'Interview'),
  ('Vishnu K', 'Fitness Trainer', 'Referral', 'Offer sent'),
  ('Meera S', 'Dietitian Asst.', 'LinkedIn', 'Screening')
on conflict do nothing;

insert into hr_documents (title, kind, person, doc_date, status) values
  ('Offer Letter — Vishnu K', 'Offer letter', 'Vishnu K', '2026-07-01', 'ready'),
  ('Experience Letter — Ramesh P', 'Experience letter', 'Ramesh P', '2026-06-22', 'ready'),
  ('Contract — Anjali R (draft)', 'Contract', 'Anjali R', null, 'draft')
on conflict do nothing;

insert into hr_purchases (item, requested_by, req_date, status) values
  ('Massage table covers (×4)', 'Dr. Roze Roshni Menon', '2026-06-28', 'ordered'),
  ('InBody printer paper', 'Sinimol Antony', '2026-07-01', 'requested'),
  ('Whiteboard markers', 'Sharafath', '2026-06-20', 'delivered')
on conflict do nothing;

insert into onboarding (name, role, joining_date, steps, status, kind)
select 'Ramesh P', 'Housekeeping', '2026-07-10',
  '[{"label":"Handover completed","done":true},{"label":"Assets returned","done":false},{"label":"Final settlement inputs","done":false},{"label":"Exit documents issued","done":false}]'::jsonb,
  'in_progress', 'offboarding'
where not exists (select 1 from onboarding where name = 'Ramesh P' and kind = 'offboarding');
