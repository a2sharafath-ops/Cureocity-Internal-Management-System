-- ============================================================================
-- Cureocity — role-aware Staff Copilot: Super Admin review-draft pilot.
-- Run after 0182.
--
-- This migration creates an append-only review trail. It does not enable the
-- pilot, call an AI provider, execute an operational action, or modify existing
-- data. Apply it in the intended non-production environment before setting
-- STAFF_COPILOT_SUPER_ADMIN_ENABLED=true.
-- ============================================================================

begin;

create table if not exists staff_copilot_drafts (
  id                 uuid primary key default gen_random_uuid(),
  role_name          text not null check (role_name = 'Super Admin'),
  task_type          text not null check (task_type in (
    'operational_summary', 'overdue_items', 'staff_access_review',
    'follow_up_suggestions'
  )),
  staff_instruction  text,
  context_snapshot   jsonb not null,
  model_name         text not null,
  prompt_version     text not null default 'Cureocity Staff Copilot Super Admin v1.0',
  title              text not null,
  draft_text         text not null,
  evidence           jsonb not null default '[]'::jsonb,
  caution            text,
  status             text not null default 'Draft'
                       check (status in ('Draft', 'Accepted', 'Discarded')),
  created_by         uuid not null default auth.uid(),
  creator_name       text not null,
  created_at         timestamptz not null default now(),
  accepted_text      text,
  accepted_by        uuid,
  accepted_by_name   text,
  accepted_at        timestamptz,
  check (
    (status = 'Accepted'
      and nullif(btrim(accepted_text), '') is not null
      and accepted_by is not null
      and accepted_by_name is not null
      and accepted_at is not null)
    or
    (status <> 'Accepted'
      and accepted_text is null
      and accepted_by is null
      and accepted_by_name is null
      and accepted_at is null)
  )
);

create index if not exists staff_copilot_drafts_creator_idx
  on staff_copilot_drafts (created_by, created_at desc);
create index if not exists staff_copilot_drafts_status_idx
  on staff_copilot_drafts (role_name, status, created_at desc);

create or replace function guard_staff_copilot_draft()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role_name is distinct from new.role_name
     or old.task_type is distinct from new.task_type
     or old.staff_instruction is distinct from new.staff_instruction
     or old.context_snapshot is distinct from new.context_snapshot
     or old.model_name is distinct from new.model_name
     or old.prompt_version is distinct from new.prompt_version
     or old.title is distinct from new.title
     or old.draft_text is distinct from new.draft_text
     or old.evidence is distinct from new.evidence
     or old.caution is distinct from new.caution
     or old.created_by is distinct from new.created_by
     or old.creator_name is distinct from new.creator_name
     or old.created_at is distinct from new.created_at then
    raise exception 'Generated Staff Copilot evidence is immutable';
  end if;
  if old.status <> 'Draft' then
    raise exception 'A completed Staff Copilot review cannot be changed';
  end if;
  if new.status not in ('Accepted', 'Discarded') then
    raise exception 'A Staff Copilot draft may only be accepted or discarded';
  end if;
  if new.status = 'Accepted' and new.accepted_by is distinct from auth.uid() then
    raise exception 'Staff Copilot acceptance must be attributed to the current user';
  end if;
  if new.status = 'Discarded' and (
    new.accepted_text is not null or new.accepted_by is not null
    or new.accepted_by_name is not null or new.accepted_at is not null
  ) then
    raise exception 'A discarded Staff Copilot draft cannot contain acceptance details';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_copilot_draft_guard on staff_copilot_drafts;
create trigger staff_copilot_draft_guard
before update on staff_copilot_drafts
for each row execute function guard_staff_copilot_draft();

alter table staff_copilot_drafts enable row level security;

drop policy if exists staff_copilot_drafts_read on staff_copilot_drafts;
drop policy if exists staff_copilot_drafts_insert on staff_copilot_drafts;
drop policy if exists staff_copilot_drafts_update on staff_copilot_drafts;

create policy staff_copilot_drafts_read on staff_copilot_drafts for select
  using (
    my_role() = 'Super Admin'
    and role_name = 'Super Admin'
    and created_by = auth.uid()
  );
create policy staff_copilot_drafts_insert on staff_copilot_drafts for insert
  with check (
    my_role() = 'Super Admin'
    and role_name = 'Super Admin'
    and created_by = auth.uid()
    and status = 'Draft'
  );
create policy staff_copilot_drafts_update on staff_copilot_drafts for update
  using (
    my_role() = 'Super Admin'
    and role_name = 'Super Admin'
    and created_by = auth.uid()
    and status = 'Draft'
  )
  with check (
    my_role() = 'Super Admin'
    and role_name = 'Super Admin'
    and created_by = auth.uid()
    and status in ('Accepted', 'Discarded')
  );
-- Deliberately no DELETE policy: discarded drafts remain in the audit trail.

revoke all on table staff_copilot_drafts from anon;
grant select, insert, update on table staff_copilot_drafts to authenticated;
revoke delete, truncate, references, trigger on table staff_copilot_drafts from authenticated;
revoke execute on function guard_staff_copilot_draft() from public, anon, authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table staff_copilot_drafts'; exception when others then null; end;
end $$;

commit;
