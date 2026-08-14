-- ============================================================================
-- Cureocity — atomic, idempotent billing/package workflows. Run after 0178.
--
-- FORWARD ONLY. This migration contains no seed data, destructive historical
-- replay, or backfill. Existing rows remain untouched. The app continues to use
-- its legacy paths until BILLING_ATOMIC_RPC_ENABLED=true is set *after* this
-- migration has been applied to the same environment.
--
-- Each RPC is one PostgreSQL transaction. An exception rolls back every write,
-- including the idempotency claim, so a safe retry can run again. A committed
-- operation key returns its stored result instead of repeating the mutation.
-- ============================================================================

begin;

-- Direct links replace fragile description matching for new records. Nullable
-- means all historical invoices/ledger rows continue to work unchanged.
alter table invoices add column if not exists client_package_id uuid
  references client_packages(id) on delete set null;
alter table invoices add column if not exists subscription_id uuid
  references subscriptions(id) on delete set null;
alter table invoices add column if not exists subscription_cycle_date date;
alter table ledger add column if not exists invoice_id uuid
  references invoices(id) on delete set null;

create index if not exists invoices_client_package_idx
  on invoices (client_package_id) where client_package_id is not null;
create index if not exists invoices_subscription_idx
  on invoices (subscription_id, subscription_cycle_date)
  where subscription_id is not null;
create index if not exists ledger_invoice_idx
  on ledger (invoice_id) where invoice_id is not null;

create table if not exists billing_operations (
  operation_key text primary key,
  kind          text not null,
  actor_id      uuid references profiles(id) on delete set null,
  result        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

alter table billing_operations enable row level security;
-- No table policy: callers interact only through the checked RPCs below.

create or replace function billing_actor_allowed(allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.role() = 'service_role'
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = any(allowed_roles)
    )
$$;

revoke all on function billing_actor_allowed(text[]) from public;

-- ---- package purchase ------------------------------------------------------

create or replace function purchase_package_atomic(
  p_operation_key text,
  p_client_id uuid,
  p_package_id text,
  p_start_date date,
  p_discount numeric,
  p_actor text,
  p_enrollment jsonb,
  p_sessions jsonb,
  p_assignments jsonb,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
  prior jsonb;
  pkg packages%rowtype;
  client_row clients%rowtype;
  category text;
  amount numeric;
  end_date date;
  package_row_id uuid;
  invoice_row_id uuid;
  invoice_number integer;
  primary_pro text;
  task_count integer := 0;
  result_row jsonb;
begin
  if not billing_actor_allowed(array['Super Admin','Administrator','Manager','Front Desk','Finance']) then
    raise exception 'Not authorized to purchase a package';
  end if;
  p_actor := coalesce(
    (select name from profiles where id = auth.uid()),
    nullif(btrim(p_actor), ''),
    'System'
  );
  if p_operation_key is null or char_length(btrim(p_operation_key)) < 8 then
    raise exception 'A valid operation key is required';
  end if;

  insert into billing_operations(operation_key, kind, actor_id)
  values (p_operation_key, 'package_purchase', auth.uid())
  on conflict do nothing returning operation_key into claimed;
  if claimed is null then
    select result into prior from billing_operations where operation_key = p_operation_key;
    return prior || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into client_row from clients where id = p_client_id for update;
  if not found then raise exception 'Client not found'; end if;
  select * into pkg from packages where id = p_package_id and coalesce(active, true) = true;
  if not found then raise exception 'Package not found or inactive'; end if;
  if p_start_date is null then raise exception 'Package start date is required'; end if;

  category := case
    when pkg.is_facility then 'membership'
    when pkg.id like 'pt%' then 'training'
    when pkg.id like 'comp%' then 'comprehensive'
    when pkg.id = 'bp1' then 'blueprint'
    else 'other'
  end;

  if category in ('training', 'comprehensive') and not (
    exists (
      select 1 from client_packages cp
      where cp.client_id = p_client_id and cp.category = 'membership'
        and cp.status = 'active' and cp.start_date <= p_start_date
        and (cp.end_date is null or cp.end_date >= p_start_date)
    )
    or exists (
      select 1 from packages legacy
      where legacy.id = client_row.package_id and legacy.is_facility = true
    )
  ) then
    raise exception 'This client needs an active membership before a PT or Comprehensive package can be purchased';
  end if;

  amount := greatest(0, coalesce(pkg.price, 0) - greatest(0, coalesce(p_discount, 0)));
  end_date := case when coalesce(pkg.validity, 0) > 0
    then p_start_date + pkg.validity else null end;

  insert into client_packages(
    client_id, package_id, package_name, category, start_date, end_date,
    price, status, created_by
  ) values (
    p_client_id, pkg.id, pkg.name, category, p_start_date, end_date,
    amount, 'active', p_actor
  ) returning id into package_row_id;

  invoice_number := next_invoice_num();
  insert into invoices(
    num, client_id, client_package_id, description, amount, status,
    issued_date, created_by
  ) values (
    invoice_number, p_client_id, package_row_id,
    pkg.name || ' package' || case when greatest(0, coalesce(p_discount, 0)) > 0
      then ' (offer −₹' || greatest(0, p_discount)::text || ')' else '' end,
    amount, 'Unpaid', current_date, p_actor
  ) returning id into invoice_row_id;

  if p_enrollment is not null and jsonb_typeof(p_enrollment) = 'object' then
    insert into enrollments(client_id, trainer_id, hour, session)
    values (
      p_client_id,
      nullif(p_enrollment->>'trainer_id', ''),
      (p_enrollment->>'hour')::integer,
      coalesce(nullif(p_enrollment->>'session', ''), 'PT')
    );
  end if;

  if jsonb_typeof(coalesce(p_sessions, '[]'::jsonb)) = 'array' then
    insert into sessions(client_id, trainer_id, seq, date, hour, status)
    select p_client_id, s.trainer_id, s.seq, s.date, s.hour, 'scheduled'
    from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb))
      as s(trainer_id text, seq integer, date date, hour integer);
  end if;

  if jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) = 'array' then
    insert into client_assignments(
      client_id, discipline, staff_id, method, assigned_by, assigned_at
    )
    select p_client_id, a.discipline, a.staff_id, a.method, p_actor, now()
    from jsonb_to_recordset(coalesce(p_assignments, '[]'::jsonb))
      as a(discipline text, staff_id text, method text)
    on conflict (client_id, discipline) do nothing;
  end if;

  select ca.staff_id into primary_pro
  from client_assignments ca
  where ca.client_id = p_client_id and ca.staff_id is not null
  order by array_position(array['doctor','trainer','dietitian','psychologist','coach'], ca.discipline)
  limit 1;
  if primary_pro is not null then
    update clients set pro_id = primary_pro where id = p_client_id;
  end if;

  if category = 'blueprint' then
    insert into blood_requests(client_id, panel, requested_at, submitted)
    values (p_client_id, 'blueprint', current_date, false)
    on conflict (client_id, panel) do update set
      requested_at = excluded.requested_at, submitted = false, submitted_date = null;
    insert into blueprints(client_id, status, updated_at)
    values (p_client_id, 'in_progress', now())
    on conflict (client_id) do nothing;
  elsif category = 'comprehensive' then
    insert into blood_requests(client_id, panel, requested_at, submitted)
    values (p_client_id, 'comprehensive', current_date, false)
    on conflict (client_id, panel) do update set
      requested_at = excluded.requested_at, submitted = false, submitted_date = null;
    insert into care_protocols(client_id, protocol, start_date, status, created_by)
    values (p_client_id, 'comprehensive', p_start_date, 'active', p_actor)
    on conflict (client_id, protocol, start_date) do nothing;
  elsif category = 'training' then
    insert into care_protocols(client_id, protocol, start_date, status, created_by)
    values (p_client_id, 'training', p_start_date, 'active', p_actor)
    on conflict (client_id, protocol, start_date) do nothing;
  end if;

  if jsonb_typeof(coalesce(p_tasks, '[]'::jsonb)) = 'array' then
    lock table tasks in share row exclusive mode;
    with inserted as (
      insert into tasks(title, client_id, type, priority, status, due_date, created_by)
      select t.title, p_client_id, coalesce(t.type, 'Ops'),
        coalesce(t.priority, 'High'), coalesce(t.status, 'todo'), t.due_date, p_actor
      from jsonb_to_recordset(coalesce(p_tasks, '[]'::jsonb))
        as t(title text, type text, priority text, status text, due_date date)
      where t.title is not null
        and not exists (
          select 1 from tasks existing
          where existing.client_id = p_client_id and existing.title = t.title
        )
      returning 1
    ) select count(*) into task_count from inserted;
  end if;

  result_row := jsonb_build_object(
    'client_id', p_client_id,
    'client_name', client_row.name,
    'package_id', pkg.id,
    'package_name', pkg.name,
    'client_package_id', package_row_id,
    'invoice_id', invoice_row_id,
    'invoice_num', invoice_number,
    'category', category,
    'amount', amount,
    'start_date', p_start_date,
    'end_date', end_date,
    'task_count', task_count,
    'idempotent_replay', false
  );
  update billing_operations set result = result_row where operation_key = p_operation_key;
  return result_row;
end;
$$;

-- ---- package renewal -------------------------------------------------------

create or replace function renew_package_atomic(
  p_operation_key text,
  p_client_id uuid,
  p_package_id text,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
  prior jsonb;
  pkg packages%rowtype;
  category text;
  latest_end date;
  start_date date;
  end_date date;
  package_row_id uuid;
  invoice_row_id uuid;
  invoice_number integer;
  result_row jsonb;
begin
  if not billing_actor_allowed(array['Super Admin','Administrator','Manager','Front Desk','Finance']) then
    raise exception 'Not authorized to renew a package';
  end if;
  p_actor := coalesce(
    (select name from profiles where id = auth.uid()),
    nullif(btrim(p_actor), ''),
    'System'
  );
  if p_operation_key is null or char_length(btrim(p_operation_key)) < 8 then
    raise exception 'A valid operation key is required';
  end if;
  insert into billing_operations(operation_key, kind, actor_id)
  values (p_operation_key, 'package_renewal', auth.uid())
  on conflict do nothing returning operation_key into claimed;
  if claimed is null then
    select result into prior from billing_operations where operation_key = p_operation_key;
    return prior || jsonb_build_object('idempotent_replay', true);
  end if;

  perform 1 from clients where id = p_client_id for update;
  if not found then raise exception 'Client not found'; end if;
  select * into pkg from packages where id = p_package_id and coalesce(active, true) = true;
  if not found then raise exception 'Package not found or inactive'; end if;
  category := case
    when pkg.is_facility then 'membership'
    when pkg.id like 'pt%' then 'training'
    when pkg.id like 'comp%' then 'comprehensive'
    when pkg.id = 'bp1' then 'blueprint'
    else 'other'
  end;
  if category = 'blueprint' then raise exception 'BluePrint cannot be renewed'; end if;

  select max(cp.end_date) into latest_end from client_packages cp
  where cp.client_id = p_client_id and cp.category = category and cp.status = 'active';
  start_date := case when latest_end is not null and latest_end >= current_date
    then latest_end + 1 else current_date end;
  end_date := case when coalesce(pkg.validity, 0) > 0
    then start_date + pkg.validity else null end;

  insert into client_packages(
    client_id, package_id, package_name, category, start_date, end_date,
    price, status, created_by
  ) values (
    p_client_id, pkg.id, pkg.name, category, start_date, end_date,
    greatest(0, coalesce(pkg.price, 0)), 'active', p_actor
  ) returning id into package_row_id;

  invoice_number := next_invoice_num();
  insert into invoices(
    num, client_id, client_package_id, description, amount, status,
    issued_date, created_by
  ) values (
    invoice_number, p_client_id, package_row_id, pkg.name || ' — renewal',
    greatest(0, coalesce(pkg.price, 0)), 'Unpaid', current_date, p_actor
  ) returning id into invoice_row_id;

  result_row := jsonb_build_object(
    'client_id', p_client_id, 'package_id', pkg.id, 'package_name', pkg.name,
    'client_package_id', package_row_id, 'invoice_id', invoice_row_id,
    'invoice_num', invoice_number, 'category', category,
    'amount', greatest(0, coalesce(pkg.price, 0)),
    'start_date', start_date, 'end_date', end_date,
    'idempotent_replay', false
  );
  update billing_operations set result = result_row where operation_key = p_operation_key;
  return result_row;
end;
$$;

-- ---- package void ----------------------------------------------------------

create or replace function void_client_package_atomic(
  p_operation_key text,
  p_package_row_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
  prior jsonb;
  package_row client_packages%rowtype;
  other_journey boolean;
  result_row jsonb;
begin
  if not billing_actor_allowed(array['Super Admin','Administrator','Manager']) then
    raise exception 'Not authorized to void a package';
  end if;
  p_actor := coalesce(
    (select name from profiles where id = auth.uid()),
    nullif(btrim(p_actor), ''),
    'System'
  );
  if p_operation_key is null or char_length(btrim(p_operation_key)) < 8 then
    raise exception 'A valid operation key is required';
  end if;
  insert into billing_operations(operation_key, kind, actor_id)
  values (p_operation_key, 'package_void', auth.uid())
  on conflict do nothing returning operation_key into claimed;
  if claimed is null then
    select result into prior from billing_operations where operation_key = p_operation_key;
    return prior || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into package_row from client_packages where id = p_package_row_id for update;
  if not found then raise exception 'Package not found'; end if;

  if package_row.status <> 'void' then
    update client_packages set status = 'void' where id = package_row.id;

    delete from invoices i
    where i.status <> 'Paid' and (
      i.client_package_id = package_row.id
      or (
        i.client_package_id is null
        and i.client_id = package_row.client_id
        and package_row.package_name is not null
        and i.description ilike package_row.package_name || '%'
      )
    );

    if package_row.category = 'membership' and package_row.package_id is not null then
      update clients set package_id = null
      where id = package_row.client_id and package_id = package_row.package_id;
    end if;

    if package_row.category in ('comprehensive','training','blueprint') then
      select exists (
        select 1 from client_packages cp
        where cp.client_id = package_row.client_id and cp.id <> package_row.id
          and cp.status = 'active'
          and cp.category in ('comprehensive','training','blueprint')
      ) into other_journey;

      if package_row.category in ('comprehensive','training') then
        update care_protocols set status = 'cancelled'
        where client_id = package_row.client_id
          and protocol = package_row.category and status = 'active';
        delete from blueprint_sla_events
        where client_id = package_row.client_id and protocol = package_row.category;
      end if;

      if not other_journey then
        delete from sessions where client_id = package_row.client_id and status <> 'completed';
        delete from tasks where client_id = package_row.client_id
          and created_by = 'auto' and status <> 'done';
        delete from followups where client_id = package_row.client_id;
        if package_row.category = 'comprehensive' then
          delete from blood_requests where client_id = package_row.client_id and panel = 'comprehensive';
        elsif package_row.category = 'blueprint' then
          delete from blood_requests where client_id = package_row.client_id and panel = 'blueprint';
        end if;
        delete from client_assignments where client_id = package_row.client_id;
        update clients set pro_id = null where id = package_row.client_id;
      end if;
    end if;
  end if;

  result_row := jsonb_build_object(
    'client_id', package_row.client_id,
    'client_package_id', package_row.id,
    'package_name', package_row.package_name,
    'category', package_row.category,
    'status', 'void',
    'idempotent_replay', package_row.status = 'void'
  );
  update billing_operations set result = result_row where operation_key = p_operation_key;
  return result_row;
end;
$$;

-- ---- invoice refund --------------------------------------------------------

create or replace function refund_invoice_atomic(
  p_operation_key text,
  p_invoice_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
  prior jsonb;
  invoice_row invoices%rowtype;
  party_name text;
  ledger_row_id uuid;
  result_row jsonb;
begin
  if not billing_actor_allowed(array['Super Admin','Administrator','Manager','Finance']) then
    raise exception 'Not authorized to refund an invoice';
  end if;
  p_actor := coalesce(
    (select name from profiles where id = auth.uid()),
    nullif(btrim(p_actor), ''),
    'System'
  );
  if p_operation_key is null or char_length(btrim(p_operation_key)) < 8 then
    raise exception 'A valid operation key is required';
  end if;
  insert into billing_operations(operation_key, kind, actor_id)
  values (p_operation_key, 'invoice_refund', auth.uid())
  on conflict do nothing returning operation_key into claimed;
  if claimed is null then
    select result into prior from billing_operations where operation_key = p_operation_key;
    return prior || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into invoice_row from invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if invoice_row.status = 'Refunded' then
    result_row := jsonb_build_object(
      'invoice_id', invoice_row.id, 'invoice_num', invoice_row.num,
      'amount', invoice_row.amount, 'status', 'Refunded',
      'idempotent_replay', true
    );
    update billing_operations set result = result_row where operation_key = p_operation_key;
    return result_row;
  end if;
  if invoice_row.status <> 'Paid' then raise exception 'Only a paid invoice can be refunded'; end if;

  update invoices set status = 'Refunded' where id = invoice_row.id;
  if invoice_row.amount > 0 then
    select name into party_name from clients where id = invoice_row.client_id;
    insert into ledger(
      account, date, ref, party, kind, direction, amount, created_by, invoice_id
    ) values (
      case when lower(coalesce(invoice_row.method, 'Cash')) = 'cash' then 'cash' else 'bank' end,
      current_date,
      'INV-' || lpad(coalesce(invoice_row.num, 0)::text, 3, '0') || ' refund',
      party_name, coalesce(invoice_row.method, 'Cash'), 'out', invoice_row.amount,
      p_actor, invoice_row.id
    ) returning id into ledger_row_id;
  end if;

  result_row := jsonb_build_object(
    'invoice_id', invoice_row.id, 'invoice_num', invoice_row.num,
    'amount', invoice_row.amount, 'status', 'Refunded',
    'ledger_id', ledger_row_id, 'idempotent_replay', false
  );
  update billing_operations set result = result_row where operation_key = p_operation_key;
  return result_row;
end;
$$;

-- ---- subscription renewal --------------------------------------------------

create or replace function renew_subscription_atomic(
  p_operation_key text,
  p_subscription_id uuid,
  p_actor text,
  p_require_due boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
  prior jsonb;
  subscription_row subscriptions%rowtype;
  package_name text;
  cycle_date date;
  next_date date;
  invoice_row_id uuid;
  invoice_number integer;
  result_row jsonb;
begin
  if not billing_actor_allowed(array['Super Admin','Administrator','Manager','Front Desk','Finance']) then
    raise exception 'Not authorized to renew a subscription';
  end if;
  p_actor := coalesce(
    (select name from profiles where id = auth.uid()),
    nullif(btrim(p_actor), ''),
    'System'
  );
  if p_operation_key is null or char_length(btrim(p_operation_key)) < 8 then
    raise exception 'A valid operation key is required';
  end if;
  insert into billing_operations(operation_key, kind, actor_id)
  values (p_operation_key, 'subscription_renewal', auth.uid())
  on conflict do nothing returning operation_key into claimed;
  if claimed is null then
    select result into prior from billing_operations where operation_key = p_operation_key;
    return prior || jsonb_build_object('idempotent_replay', true);
  end if;

  select * into subscription_row from subscriptions
  where id = p_subscription_id for update;
  if not found then raise exception 'Subscription not found'; end if;
  if subscription_row.status = 'cancelled' then raise exception 'Cancelled subscriptions cannot renew'; end if;
  if p_require_due and not (
    subscription_row.status = 'active'
    and subscription_row.auto_renew = true
    and subscription_row.renews_on is not null
    and subscription_row.renews_on <= current_date
  ) then
    raise exception 'Subscription is not due for automatic renewal';
  end if;

  cycle_date := coalesce(subscription_row.renews_on, current_date);
  select name into package_name from packages where id = subscription_row.package_id;
  invoice_number := next_invoice_num();
  insert into invoices(
    num, client_id, subscription_id, subscription_cycle_date,
    description, amount, status, issued_date, created_by
  ) values (
    invoice_number, subscription_row.client_id, subscription_row.id, cycle_date,
    coalesce(package_name, 'Subscription') || ' — renewal',
    subscription_row.amount, 'Unpaid', current_date, p_actor
  ) returning id into invoice_row_id;

  next_date := greatest(cycle_date, current_date) + subscription_row.interval_days;
  update subscriptions set renews_on = next_date where id = subscription_row.id;

  result_row := jsonb_build_object(
    'subscription_id', subscription_row.id,
    'client_id', subscription_row.client_id,
    'invoice_id', invoice_row_id,
    'invoice_num', invoice_number,
    'cycle_date', cycle_date,
    'next_renews_on', next_date,
    'amount', subscription_row.amount,
    'idempotent_replay', false
  );
  update billing_operations set result = result_row where operation_key = p_operation_key;
  return result_row;
end;
$$;

revoke all on function purchase_package_atomic(text, uuid, text, date, numeric, text, jsonb, jsonb, jsonb, jsonb) from public, authenticated;
revoke all on function renew_package_atomic(text, uuid, text, text) from public, authenticated;
revoke all on function void_client_package_atomic(text, uuid, text) from public, authenticated;
revoke all on function refund_invoice_atomic(text, uuid, text) from public, authenticated;
revoke all on function renew_subscription_atomic(text, uuid, text, boolean) from public, authenticated;

-- The payload includes server-planned sessions, care assignments and tasks.
-- Keep these functions off the browser-facing authenticated role so callers
-- cannot forge that plan; permission remains enforced by the guarded server
-- actions, which invoke the RPC with the server-only service-role client.
grant execute on function purchase_package_atomic(text, uuid, text, date, numeric, text, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function renew_package_atomic(text, uuid, text, text) to service_role;
grant execute on function void_client_package_atomic(text, uuid, text) to service_role;
grant execute on function refund_invoice_atomic(text, uuid, text) to service_role;
grant execute on function renew_subscription_atomic(text, uuid, text, boolean) to service_role;

commit;

-- Verification after applying in a non-production environment:
--   1. Call each RPC twice with the same operation key; the second result must
--      contain idempotent_replay=true and row counts must not change.
--   2. Force a late constraint failure (for example an invalid trainer in the
--      sessions JSON); neither the package nor invoice may remain.
--   3. Only after those checks, set BILLING_ATOMIC_RPC_ENABLED=true for the app.
