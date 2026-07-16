-- ============================================================================
-- Cureocity — audit log.
-- Records who did what (staff creation, role changes, client edits, lead moves,
-- session reschedules & check-ins). Run in Supabase SQL Editor after 0002.
-- ============================================================================

create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid,
  actor_name text,
  actor_role text,
  action     text not null,     -- e.g. "Role changed", "Staff created", "Session rescheduled"
  target     text,              -- what it affected (client name, email, etc.)
  detail     text,              -- extra context
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);

alter table audit_log enable row level security;

-- any signed-in user's server action can insert (writes go through checked actions);
-- reads are gated in the app to Administrators.
drop policy if exists audit_insert on audit_log;
drop policy if exists audit_read   on audit_log;
create policy audit_insert on audit_log for insert with check (auth.uid() is not null);
create policy audit_read   on audit_log for select using (auth.uid() is not null);
