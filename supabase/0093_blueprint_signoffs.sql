-- ============================================================================
-- BluePrint consolidated sign-off — the real multi-clinician gate.
--
-- Every clinician assigned to the client (doctor / dietitian / trainer / coach /
-- psychologist, whichever are on the care team) must sign off the CONSOLIDATED
-- summary. The Blueprint auto-generates only once every assigned discipline has
-- signed. This replaces the old single-click "sign off & generate", which let
-- one clinician generate on their own.
--
-- One row per (client, discipline) sign-off, so it's auditable and idempotent.
-- ============================================================================

create table if not exists blueprint_signoffs (
  client_id  uuid not null references clients(id) on delete cascade,
  discipline text not null,   -- doctor | dietitian | trainer | coach | psychologist
  by_name    text,
  by_role    text,
  signed_at  timestamptz not null default now(),
  primary key (client_id, discipline)
);

alter table blueprint_signoffs enable row level security;
-- Readable/writable by any authenticated staff; the server action enforces that
-- a clinician only signs off their own discipline (admins may sign any).
drop policy if exists bp_signoff_read  on blueprint_signoffs;
drop policy if exists bp_signoff_write on blueprint_signoffs;
create policy bp_signoff_read  on blueprint_signoffs for select using (auth.uid() is not null);
create policy bp_signoff_write on blueprint_signoffs for all    using (auth.uid() is not null) with check (auth.uid() is not null);

-- Extend the per-discipline INDIVIDUAL-approval status to include coach + psych
-- (security-definer so every discipline can see the whole team's progress even
-- though RLS otherwise hides other disciplines' consultations).
drop function if exists blueprint_signoff();
create or replace function blueprint_signoff()
returns table (client_id uuid, doctor boolean, diet boolean, trainer boolean, coach boolean, psych boolean)
language plpgsql security definer stable set search_path = public as $$
begin
  if not is_staff() then return; end if;
  return query
    select c.id,
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Doctor'       and x.approved),
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Diet'         and x.approved),
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Trainer'      and x.approved),
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Coach'        and x.approved),
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Psychologist' and x.approved)
    from clients c
    where c.package_id = 'bp1';
end $$;
