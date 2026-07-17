-- ============================================================================
-- Cureocity — telehealth video sessions. Run after 0041 (SQL Editor).
-- Works out of the box via public Jitsi rooms; a provider key upgrades to
-- private/recorded rooms.
-- ============================================================================

create table if not exists telehealth_sessions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete set null,
  provider      text default 'jitsi',
  room_url      text,
  status        text not null default 'scheduled',  -- scheduled | active | ended
  scheduled_for timestamptz,
  started_at    timestamptz,
  ended_at      timestamptz,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists teleh_client_idx on telehealth_sessions (client_id);
create index if not exists teleh_status_idx on telehealth_sessions (status);

alter table telehealth_sessions enable row level security;
drop policy if exists teleh_staff       on telehealth_sessions;
drop policy if exists teleh_client_read on telehealth_sessions;
create policy teleh_staff       on telehealth_sessions for all    using (is_staff()) with check (is_staff());
create policy teleh_client_read on telehealth_sessions for select using (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table telehealth_sessions'; exception when others then null; end;
end $$;
