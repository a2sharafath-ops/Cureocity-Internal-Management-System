-- ============================================================================
-- Cureocity — staff expense reimbursements. Run after 0086 (SQL Editor).
--
-- The gap this fills: a staff member spends their own money (client cab,
-- refreshments, supplies), claims it, someone approves it, and the business
-- pays them back. Distinct from `expenses` (company opex, no payee/approval)
-- and `payables` (vendor bills). Workflow: Submitted -> Approved -> Paid,
-- with a Rejected branch.
--
-- Submitters: Finance / Administrator / Super Admin.  Approver+payer: Super Admin.
-- On Paid we post BOTH an `expenses` row (the cost, feeds P&L "spend") AND a
-- ledger `out` entry (the cash leaving) — two books, no double-count. The
-- expense_id / ledger_id columns record what was posted so it is traceable and
-- never posted twice.
-- ============================================================================

create table if not exists reimbursements (
  id            uuid primary key default gen_random_uuid(),
  payee_staff   uuid,                                -- staff(id), nullable if off-directory
  payee_name    text not null,                       -- denormalised so it survives staff edits
  description   text not null,
  category      text not null default 'Other',       -- Travel | Meals | Supplies | Client care | Other
  amount        numeric not null default 0,
  incurred_date date   not null default current_date,
  status        text   not null default 'Submitted', -- Submitted | Approved | Rejected | Paid
  -- receipt image (private 'finance' bucket)
  receipt_bucket text,
  receipt_path   text,
  -- posting trace (set when Paid)
  pay_account   text,                                -- bank | cash
  expense_id    uuid,
  ledger_id     uuid,
  -- workflow trail
  reject_reason text,
  submitted_by  text,
  approved_by   text,
  paid_by       text,
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  paid_at       timestamptz
);
create index if not exists reimbursements_status_idx on reimbursements (status, created_at desc);
create index if not exists reimbursements_payee_idx  on reimbursements (payee_staff);

alter table reimbursements enable row level security;
drop policy if exists reimbursements_staff on reimbursements;
-- Read/write gated in the server actions by role; RLS keeps it to signed-in
-- staff (mirrors payables/estimates/ledger).
create policy reimbursements_staff on reimbursements for all using (is_staff()) with check (is_staff());

-- ---- private storage bucket for receipts ------------------------------------
insert into storage.buckets (id, name, public)
values ('finance', 'finance', false)
on conflict (id) do nothing;

-- Staff-only access to the finance bucket (receipts can contain amounts/PII).
drop policy if exists finance_bucket_staff on storage.objects;
create policy finance_bucket_staff on storage.objects
  for all to authenticated
  using (bucket_id = 'finance' and is_staff())
  with check (bucket_id = 'finance' and is_staff());

-- ---- seed -------------------------------------------------------------------
insert into reimbursements (payee_name, description, category, amount, incurred_date, status, submitted_by) values
  ('Thamanna Nazer', 'Cab to client home visit', 'Travel',     640,  current_date - 1, 'Submitted', 'Thamanna Nazer'),
  ('Sini Simon',     'Refreshments for member event', 'Client care', 2200, current_date - 3, 'Approved',  'Sini Simon'),
  ('Jobin Joseph',   'Printer ink + stationery',      'Supplies', 1150, current_date - 6, 'Paid',      'Jobin Joseph')
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table reimbursements'; exception when others then null; end;
end $$;
