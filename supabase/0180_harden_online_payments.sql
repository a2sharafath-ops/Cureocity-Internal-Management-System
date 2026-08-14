-- ============================================================================
-- Cureocity — bind and settle online payments safely. Run after 0179.
--
-- FORWARD ONLY. No gateway is enabled by this migration and no historical row
-- is replayed. Existing references stay untouched. New checkout orders record
-- their expected amount/currency, and both browser confirmation and webhooks
-- settle through one locked, idempotent transaction.
-- ============================================================================

begin;

alter table invoices add column if not exists gateway_order_amount bigint;
alter table invoices add column if not exists gateway_order_currency text;

-- A gateway order/payment may settle at most one invoice. Fail the migration
-- visibly if legacy duplicates exist; those must be reconciled, never guessed.
create unique index if not exists invoices_gateway_order_uidx
  on invoices (gateway_order_id) where gateway_order_id is not null;
create unique index if not exists invoices_gateway_payment_uidx
  on invoices (gateway_payment_id) where gateway_payment_id is not null;

create or replace function settle_online_invoice_atomic(
  p_invoice_id uuid,
  p_order_id text,
  p_payment_id text,
  p_amount_minor bigint,
  p_currency text,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_row invoices%rowtype;
  expected_minor bigint;
  party_name text;
  ledger_row_id uuid;
  result_row jsonb;
begin
  -- Browser users cannot execute this RPC directly (grant below). The guarded
  -- server action and signed webhook use the service role after verifying the
  -- caller/signature and the gateway payment entity.
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if nullif(btrim(p_order_id), '') is null
     or nullif(btrim(p_payment_id), '') is null then
    raise exception 'Gateway order and payment ids are required';
  end if;

  select * into invoice_row from invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;

  -- Webhooks are retried, and checkout confirmation commonly races the webhook.
  -- An exact prior settlement (including a later refund) is a successful replay.
  if invoice_row.status in ('Paid', 'Refunded')
     and invoice_row.gateway_order_id = p_order_id
     and invoice_row.gateway_payment_id = p_payment_id then
    return jsonb_build_object(
      'invoice_id', invoice_row.id,
      'invoice_num', invoice_row.num,
      'amount', invoice_row.amount,
      'status', invoice_row.status,
      'idempotent_replay', true
    );
  end if;

  if invoice_row.status <> 'Unpaid' then
    raise exception 'Invoice is not eligible for payment';
  end if;
  if invoice_row.gateway <> 'razorpay'
     or invoice_row.gateway_order_id is distinct from p_order_id then
    raise exception 'Payment does not match the invoice gateway order';
  end if;

  expected_minor := round(invoice_row.amount * 100)::bigint;
  if invoice_row.gateway_order_amount is null
     or invoice_row.gateway_order_currency is null then
    raise exception 'Invoice gateway order lacks hardened amount metadata';
  end if;
  if invoice_row.gateway_order_amount <> expected_minor
     or p_amount_minor <> expected_minor then
    raise exception 'Payment amount does not match the invoice';
  end if;
  if upper(invoice_row.gateway_order_currency) <> upper(p_currency)
     or upper(p_currency) <> 'INR' then
    raise exception 'Payment currency does not match the invoice';
  end if;
  if exists (
    select 1 from invoices other
    where other.gateway_payment_id = p_payment_id and other.id <> invoice_row.id
  ) then
    raise exception 'Gateway payment is already attached to another invoice';
  end if;

  update invoices set
    status = 'Paid',
    paid_date = current_date,
    method = 'Online',
    gateway_payment_id = p_payment_id
  where id = invoice_row.id;

  select name into party_name from clients where id = invoice_row.client_id;
  insert into ledger(
    account, date, ref, party, kind, direction, amount, created_by, invoice_id
  ) values (
    'bank', current_date,
    'INV-' || lpad(coalesce(invoice_row.num, 0)::text, 3, '0'),
    party_name, 'Online', 'in', invoice_row.amount,
    coalesce(nullif(btrim(p_actor), ''), 'Razorpay'), invoice_row.id
  ) returning id into ledger_row_id;

  insert into audit_log(actor_name, action, target, detail)
  values (
    coalesce(nullif(btrim(p_actor), ''), 'Razorpay'),
    'Invoice paid online',
    'INV-' || lpad(coalesce(invoice_row.num, 0)::text, 3, '0'),
    p_payment_id
  );

  result_row := jsonb_build_object(
    'invoice_id', invoice_row.id,
    'invoice_num', invoice_row.num,
    'amount', invoice_row.amount,
    'status', 'Paid',
    'ledger_id', ledger_row_id,
    'idempotent_replay', false
  );
  return result_row;
end;
$$;

revoke all on function settle_online_invoice_atomic(uuid, text, text, bigint, text, text)
  from public, authenticated;
grant execute on function settle_online_invoice_atomic(uuid, text, text, bigint, text, text)
  to service_role;

commit;

-- Non-production rollout verification before enabling PAYMENT_PROVIDER:
--   1. Create one test order and confirm its stored amount/currency/order id.
--   2. Call settlement twice with the same payment; only one invoice update and
--      one ledger receipt may exist, and the second result must be a replay.
--   3. Wrong order, amount, currency, payment reuse and non-Unpaid status must
--      all fail without changing either invoices or ledger.
