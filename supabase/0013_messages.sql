-- ============================================================================
-- Cureocity — Communications / inbox: per-client message threads.
-- Run after 0006 (SQL Editor -> Run).
-- ============================================================================

create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  sender      text not null,          -- 'staff' | 'client'
  sender_name text,
  body        text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists messages_client_idx on messages (client_id, created_at);

alter table messages enable row level security;
drop policy if exists messages_staff        on messages;
drop policy if exists messages_client_read  on messages;
drop policy if exists messages_client_write on messages;
create policy messages_staff        on messages for all    using (is_staff()) with check (is_staff());
create policy messages_client_read  on messages for select using (client_id = my_client_id());
create policy messages_client_write on messages for insert with check (client_id = my_client_id());

-- realtime
do $$ begin
  begin execute 'alter publication supabase_realtime add table messages'; exception when others then null; end;
end $$;
