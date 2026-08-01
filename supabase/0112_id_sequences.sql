-- Cureocity — race-safe client codes & invoice numbers. Run after 0111 in the
-- Supabase SQL editor. Replaces the old count(*)+1 / max(num)+1 generation,
-- which collided when two conversions ran at once and reused a number after a
-- row was deleted, with Postgres sequences handed out one value at a time.
-- The app (lib/actions.ts) calls next_invoice_num() / next_client_code() and
-- falls back to the old method if these functions aren't present yet, so the
-- deploy and this migration can land in either order.

-- 1. Invoice number sequence, seeded past the current max ----------------------
do $$
declare mx bigint;
begin
  select coalesce(max(num), 0) into mx from invoices;
  if to_regclass('public.invoice_num_seq') is null then
    execute format('create sequence invoice_num_seq start %s', mx + 1);
  end if;
end $$;

create or replace function next_invoice_num() returns integer
  language sql volatile security definer set search_path = public as $$
  select nextval('invoice_num_seq')::integer;
$$;

-- 2. Client code sequence (CUR-###), seeded past the current numeric max -------
do $$
declare mx bigint;
begin
  select coalesce(max(nullif(regexp_replace(code, '\D', '', 'g'), '')::bigint), 0)
    into mx from clients where code ~ '^CUR-\d+$';
  if to_regclass('public.client_code_seq') is null then
    execute format('create sequence client_code_seq start %s', mx + 1);
  end if;
end $$;

create or replace function next_client_code() returns text
  language sql volatile security definer set search_path = public as $$
  select 'CUR-' || lpad(nextval('client_code_seq')::text, 3, '0');
$$;

grant execute on function next_invoice_num() to anon, authenticated, service_role;
grant execute on function next_client_code() to anon, authenticated, service_role;

-- 3. Belt-and-braces: reject duplicate codes / numbers at the DB level. Skipped
-- (with a notice) if legacy duplicates already exist, so this migration never
-- fails on old data — clean those up, then re-run this block if you want the
-- guarantee. ------------------------------------------------------------------
do $$
begin
  begin
    create unique index if not exists clients_code_uidx on clients (code);
  exception when others then
    raise notice 'clients.code left non-unique — duplicates exist, skipping';
  end;
  begin
    create unique index if not exists invoices_num_uidx on invoices (num);
  exception when others then
    raise notice 'invoices.num left non-unique — duplicates exist, skipping';
  end;
end $$;
