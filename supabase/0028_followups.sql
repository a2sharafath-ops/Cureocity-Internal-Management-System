-- ============================================================================
-- Cureocity — front-desk follow-up queue. Run after 0027 (SQL Editor).
-- Onboarding touchpoint protocol (Day 2 / 10 / 21 / 28) + renewal nudges.
-- ============================================================================

create table if not exists followups (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  kind       text not null default 'onboarding',   -- onboarding | renewal | custom
  label      text not null,                         -- "Day 2 check-in", "Renewal due (2026-08-01)"
  due_date   date not null,
  priority   text not null default 'normal',        -- normal | mandatory
  status     text not null default 'pending',       -- pending | done | skipped
  note       text,
  done_by    text,
  done_at    timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  unique (client_id, label)
);
create index if not exists followups_due_idx    on followups (due_date);
create index if not exists followups_status_idx on followups (status);
create index if not exists followups_client_idx on followups (client_id);

alter table followups enable row level security;
drop policy if exists followups_staff on followups;
create policy followups_staff on followups for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table followups'; exception when others then null; end;
end $$;
