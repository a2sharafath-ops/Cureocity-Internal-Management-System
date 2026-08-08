-- ============================================================================
-- Cureocity — RLS hardening. Run after 0132.
--
-- Four holes, all the same shape: a policy written as "is anyone signed in?"
-- or "is this a staff member?" guarding data that needs a narrower answer. The
-- server actions were gated correctly in every case — but a Supabase session
-- token works directly against PostgREST, so the application layer is not a
-- boundary. Only these policies are.
--
--   1. blueprint_signoffs — writable by ANY authenticated user, incl. a client
--   2. audit_log          — insertable by anyone, with a forged actor
--   3. HR / payroll       — readable by every staff role
--   4. staff bank details — same, and columns can't be hidden by RLS at all
--
-- Nothing here deletes a row. Section 4 MOVES three columns to a new table and
-- drops them from `staff`; the data is copied first and verified in the same
-- transaction-less script, so re-running it is safe.
-- ============================================================================


-- ---- helpers ---------------------------------------------------------------
-- Mirrors canHr() / canFinanceOps() in lib/roles.ts. Kept as functions so the
-- role list lives in one place per layer rather than being repeated per policy.

create or replace function is_hr()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(my_role() in ('Super Admin', 'Administrator', 'Manager', 'HR'), false)
$$;
comment on function is_hr() is
  'HR-desk access: payroll, attendance, leave, employee documents, bank details. Mirrors canHr() in lib/roles.ts.';

create or replace function is_finance_ops()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(my_role() in ('Super Admin', 'Administrator', 'Manager', 'Finance'), false)
$$;
comment on function is_finance_ops() is
  'Money-desk access: reimbursements, petty cash, ledger. Mirrors canFinanceOps() in lib/roles.ts.';

-- The staff row belonging to the caller, so people can see their OWN payslip,
-- attendance and leave without being able to see anyone else's.
-- `text`, not uuid: staff.id is text across this schema (0001 declares
-- `id text primary key`, and 0002/0036/0096/0124 all reference it as text).
--
-- Dropped first rather than `create or replace`d: Postgres will not let you
-- change a function's return type in place, so a half-applied earlier attempt
-- would block the corrected one.
drop function if exists my_staff_id();
create or replace function my_staff_id()
returns text language sql security definer stable set search_path = public as $$
  select staff_id from profiles where id = auth.uid()
$$;
comment on function my_staff_id() is
  'The caller''s own staff row, or null. Lets HR tables grant self-access without granting clinic-wide access.';


-- ---- 1. BluePrint sign-offs ------------------------------------------------
-- Was: auth.uid() is not null — true for a CLIENT portal login. The sign-off
-- table is the gate that stops one clinician generating a BluePrint alone, so a
-- client could both read the roster of who has signed and forge a signature.
-- The file that created it (0093) says "any authenticated staff" in its comment;
-- this makes the SQL say the same thing.

drop policy if exists bp_signoff_read  on blueprint_signoffs;
drop policy if exists bp_signoff_write on blueprint_signoffs;
create policy bp_signoff_read  on blueprint_signoffs for select using (is_staff());
create policy bp_signoff_write on blueprint_signoffs for all    using (is_staff()) with check (is_staff());


-- ---- 2. Audit log ----------------------------------------------------------
-- Read was tightened to is_staff() back in 0006; INSERT never was. Any signed-in
-- user could write a row with an arbitrary actor_id / actor_name / actor_role —
-- which is precisely the field you would rely on after an incident.
--
-- `actor_id = auth.uid()` pins the row to the caller. getProfile() returns the
-- auth user id, and logAudit() writes that, so no application change is needed.
-- Rows written by the service-role key (cron jobs, webhooks) bypass RLS
-- entirely and are unaffected.
--
-- NOT `is_staff() and …`: the client portal legitimately writes audit rows
-- ("Blood report submitted (portal)", file uploads, messages). Requiring staff
-- would have silently stopped logging those — logAudit swallows its errors, so
-- the only symptom would be entries quietly ceasing to appear. Pinning to the
-- caller blocks forgery without caring who the caller is. A null actor is
-- allowed for staff only, for the handful of system-ish writes.

drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert
  with check (actor_id = auth.uid() or (actor_id is null and is_staff()));


-- ---- 3. HR and money tables ------------------------------------------------
-- Every one of these was `for all using (is_staff())`, so a Fitness Trainer or
-- a Front Desk login could read salaries and reimbursements straight from the
-- API — and subscribe to changes live, since they were added to the realtime
-- publication. Split into: HR/Finance may do anything; everyone else may read
-- only their own row.

-- attendance / leaves / payroll: self-read, HR-write.
drop policy if exists attendance_staff on attendance;
drop policy if exists leaves_staff     on leaves;
drop policy if exists payroll_staff    on payroll;

create policy attendance_read  on attendance for select using (is_hr() or staff_id = my_staff_id());
create policy attendance_write on attendance for all    using (is_hr()) with check (is_hr());

create policy leaves_read  on leaves for select using (is_hr() or staff_id = my_staff_id());
create policy leaves_write on leaves for all    using (is_hr()) with check (is_hr());

create policy payroll_read  on payroll for select using (is_hr() or staff_id = my_staff_id());
create policy payroll_write on payroll for all    using (is_hr()) with check (is_hr());

-- salary_structures / employee_documents: HR only, plus your own.
drop policy if exists salary_structures_staff  on salary_structures;
drop policy if exists employee_documents_staff on employee_documents;

create policy salary_structures_read  on salary_structures for select using (is_hr() or staff_id = my_staff_id());
create policy salary_structures_write on salary_structures for all    using (is_hr()) with check (is_hr());

create policy employee_documents_read  on employee_documents for select using (is_hr() or staff_id = my_staff_id());
create policy employee_documents_write on employee_documents for all    using (is_hr()) with check (is_hr());

-- leave_types / holidays are reference data — everyone needs to READ them to
-- book leave; only HR edits them.
drop policy if exists leave_types_staff on leave_types;
drop policy if exists holidays_staff    on holidays;

create policy leave_types_read  on leave_types for select using (is_staff());
create policy leave_types_write on leave_types for all    using (is_hr()) with check (is_hr());

create policy holidays_read  on holidays for select using (is_staff());
create policy holidays_write on holidays for all    using (is_hr()) with check (is_hr());

-- reimbursements: the money desk only.
--
-- No self-read clause here, unlike the HR tables above. The table has no
-- `staff_id` — the payee is `payee_staff` plus a denormalised `payee_name`
-- (0087) — and more to the point, employees don't raise their own claims in
-- this workflow: canReimburseSubmit() is Administrator/Finance, and only Super
-- Admin approves. So there is nobody whose "own" row this would be.
drop policy if exists reimbursements_staff on reimbursements;
create policy reimbursements_ops on reimbursements for all
  using (is_finance_ops()) with check (is_finance_ops());

-- Take the sensitive ones out of the realtime broadcast. A subscriber receives
-- payloads through the same RLS, but there is no reason to publish payroll at
-- all, and it is one fewer thing depending on the policy being right.
do $$ declare t text;
begin
  foreach t in array array['payroll','salary_structures','employee_documents','reimbursements','attendance','leaves']
  loop
    begin execute format('alter publication supabase_realtime drop table %I', t); exception when others then null; end;
  end loop;
end $$;


-- ---- 4. Staff bank details -------------------------------------------------
-- RLS is ROW-level: there is no way to hide three columns of `staff` from a
-- role that must read the rest of the row (every screen needs staff names). So
-- the bank fields move to their own table with an HR-only policy.
--
-- emp_code and work_location stay on `staff` — they appear on the payslip but
-- are not sensitive, and other screens use them.

create table if not exists staff_bank_details (
  staff_id     text primary key references staff(id) on delete cascade,
  bank_name    text,
  bank_account text,
  ifsc         text,
  updated_at   timestamptz not null default now()
);

alter table staff_bank_details enable row level security;
drop policy if exists staff_bank_hr on staff_bank_details;
-- No self-read: an employee seeing their own account number adds nothing (it is
-- on their payslip, which HR issues) and widens the blast radius of a stolen
-- session. HR only.
create policy staff_bank_hr on staff_bank_details for all using (is_hr()) with check (is_hr());

-- Copy anything already captured, then drop the source columns. Guarded so the
-- script is safe to run twice.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'staff' and column_name = 'bank_account'
  ) then
    insert into staff_bank_details (staff_id, bank_name, bank_account, ifsc)
    select id, bank_name, bank_account, ifsc
      from staff
     where bank_name is not null or bank_account is not null or ifsc is not null
    on conflict (staff_id) do nothing;

    alter table staff drop column if exists bank_name;
    alter table staff drop column if exists bank_account;
    alter table staff drop column if exists ifsc;
  end if;
end $$;


-- ---- verification ----------------------------------------------------------
-- After running, these should all return the tightened definition:
--   select tablename, policyname, qual from pg_policies
--    where tablename in ('blueprint_signoffs','audit_log','payroll','reimbursements','staff_bank_details')
--    order by tablename, policyname;
--
-- And this should return zero rows (columns gone from staff):
--   select column_name from information_schema.columns
--    where table_name = 'staff' and column_name in ('bank_name','bank_account','ifsc');
