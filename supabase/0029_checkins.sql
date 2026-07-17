-- ============================================================================
-- Cureocity — front-desk access & check-in log. Run after 0028 (SQL Editor).
-- Members and guests entering/leaving the centre (biometric / card / manual /
-- QR). Distinct from trainer session check-ins.
-- ============================================================================

create table if not exists checkins (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete set null,
  guest_name text,
  method     text not null default 'manual',   -- biometric | card | manual | qr
  direction  text not null default 'in',        -- in | out
  note       text,
  by_name    text,
  at         timestamptz not null default now()
);
create index if not exists checkins_at_idx     on checkins (at desc);
create index if not exists checkins_client_idx on checkins (client_id);

alter table checkins enable row level security;
drop policy if exists checkins_staff       on checkins;
drop policy if exists checkins_client_read on checkins;
create policy checkins_staff       on checkins for all    using (is_staff()) with check (is_staff());
create policy checkins_client_read on checkins for select using (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table checkins'; exception when others then null; end;
end $$;
