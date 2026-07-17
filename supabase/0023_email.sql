-- ============================================================================
-- Cureocity — email notification log. Run after 0022 (SQL Editor).
-- The email layer is a key-ready scaffold: rows are logged even when the
-- provider isn't configured (status = 'skipped'), so you get an audit trail
-- and can wire the real sender later without code changes.
-- ============================================================================

create table if not exists email_log (
  id          uuid primary key default gen_random_uuid(),
  to_email    text not null,
  client_id   uuid references clients(id) on delete set null,
  template    text,
  subject     text,
  status      text not null default 'queued',   -- queued | sent | failed | skipped
  provider    text,
  provider_id text,
  error       text,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists email_log_created_idx on email_log (created_at desc);
create index if not exists email_log_client_idx  on email_log (client_id);

alter table email_log enable row level security;
drop policy if exists email_log_staff on email_log;
create policy email_log_staff on email_log for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table email_log'; exception when others then null; end;
end $$;
