-- ============================================================================
-- Cureocity — petty cash: voucher numbering + imprest float. Run after 0087.
--
-- The Cash tab was one combined in/out list. This turns it into a proper
-- petty-cash book: every cash entry gets an auto voucher number (RV- for
-- receipts / cash-in, PV- for payments / cash-out) and the business can set a
-- fixed float (imprest) so the app flags when cash-in-hand runs low.
--
-- Numbering is done by a BEFORE INSERT trigger so EVERY path that writes a cash
-- ledger row (the manual form, reimbursement payouts, future callers) is
-- covered without touching each one — same approach as the lead stage clock.
-- ============================================================================

-- ---- voucher number on cash ledger rows ------------------------------------
alter table ledger add column if not exists voucher_no integer;

-- Backfill existing cash rows: number per direction in chronological order.
with numbered as (
  select id, row_number() over (partition by direction order by date, created_at) as rn
  from ledger where account = 'cash'
)
update ledger l set voucher_no = n.rn
from numbered n where l.id = n.id and l.voucher_no is null;

create or replace function assign_cash_voucher_no() returns trigger as $$
begin
  -- Only cash entries are vouchered; bank entries keep their own ref.
  if new.account = 'cash' and new.voucher_no is null then
    select coalesce(max(voucher_no), 0) + 1 into new.voucher_no
    from ledger where account = 'cash' and direction = new.direction;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ledger_cash_voucher on ledger;
create trigger ledger_cash_voucher
  before insert on ledger
  for each row execute function assign_cash_voucher_no();

-- ---- imprest float config (single row) -------------------------------------
create table if not exists petty_cash_config (
  id            boolean primary key default true,
  float_amount  numeric not null default 5000,   -- the fixed float / imprest
  low_threshold numeric not null default 1000,   -- flag a top-up below this
  updated_by    text,
  updated_at    timestamptz not null default now(),
  constraint petty_cash_config_singleton check (id)
);
insert into petty_cash_config (id) values (true) on conflict (id) do nothing;

alter table petty_cash_config enable row level security;
drop policy if exists petty_cash_config_staff on petty_cash_config;
create policy petty_cash_config_staff on petty_cash_config for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table petty_cash_config'; exception when others then null; end;
end $$;
