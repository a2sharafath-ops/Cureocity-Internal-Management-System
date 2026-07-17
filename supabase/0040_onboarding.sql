-- ============================================================================
-- Cureocity — HR recruitment / onboarding checklist. Run after 0039.
-- ============================================================================

create table if not exists onboarding (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  role         text,
  joining_date date,
  steps        jsonb not null default '[]',   -- [{label, done}]
  status       text not null default 'in_progress',  -- in_progress | complete
  created_by   text,
  created_at   timestamptz not null default now()
);

alter table onboarding enable row level security;
drop policy if exists onboarding_staff on onboarding;
create policy onboarding_staff on onboarding for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table onboarding'; exception when others then null; end;
end $$;
