-- ============================================================================
-- Cureocity — Health Coach 360 phase 8: guarded AI Copilot drafts.
-- Run after 0171.
--
-- Generation and acceptance are separate events. A draft has no clinical or
-- operational effect until a Health Coach explicitly accepts its edited text.
-- This table is an append-only audit trail; accepted text remains labelled as
-- AI-assisted and is not sent to a client or written into another care record.
-- ============================================================================

begin;

create table if not exists coach_copilot_drafts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  task_type        text not null check (task_type in (
    'behaviour_summary', 'missing_documentation', 'question_pathway',
    'barrier_category', 'if_then_goal', 'warm_referral', 'overdue_tasks',
    'mdt_summary', 'conflicts'
  )),
  coach_instruction text,
  context_snapshot  jsonb not null,
  model_name        text not null,
  prompt_version    text not null default 'Cureocity HC360 Copilot v1.0',
  title             text not null,
  draft_text        text not null,
  evidence          jsonb not null default '[]'::jsonb,
  caution           text,
  status            text not null default 'Draft'
                      check (status in ('Draft', 'Accepted', 'Discarded')),
  created_by        uuid not null default auth.uid(),
  creator_name      text not null,
  created_at        timestamptz not null default now(),
  accepted_text     text,
  accepted_by       uuid,
  accepted_by_name  text,
  accepted_at       timestamptz,
  check (status <> 'Accepted' or (
    nullif(btrim(accepted_text), '') is not null
    and accepted_by is not null and accepted_at is not null
  ))
);

create index if not exists coach_copilot_drafts_client_idx
  on coach_copilot_drafts (client_id, created_at desc);
create index if not exists coach_copilot_drafts_creator_idx
  on coach_copilot_drafts (created_by, created_at desc);

create or replace function guard_coach_copilot_draft()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.client_id is distinct from new.client_id
       or old.task_type is distinct from new.task_type
       or old.coach_instruction is distinct from new.coach_instruction
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
      raise exception 'Generated Copilot evidence is immutable';
    end if;
    if old.status <> 'Draft' then
      raise exception 'A completed Copilot review cannot be changed';
    end if;
    if new.status = 'Accepted' and new.accepted_by is distinct from auth.uid() then
      raise exception 'Copilot acceptance must be attributed to the current user';
    end if;
    if new.status = 'Discarded' and (
      new.accepted_text is not null or new.accepted_by is not null
      or new.accepted_by_name is not null or new.accepted_at is not null
    ) then
      raise exception 'A discarded draft cannot contain acceptance details';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coach_copilot_draft_guard on coach_copilot_drafts;
create trigger coach_copilot_draft_guard
before update on coach_copilot_drafts
for each row execute function guard_coach_copilot_draft();

alter table coach_copilot_drafts enable row level security;

drop policy if exists coach_copilot_drafts_read on coach_copilot_drafts;
drop policy if exists coach_copilot_drafts_insert on coach_copilot_drafts;
drop policy if exists coach_copilot_drafts_update on coach_copilot_drafts;
create policy coach_copilot_drafts_read on coach_copilot_drafts for select
  using (is_admin() or created_by = auth.uid());
create policy coach_copilot_drafts_insert on coach_copilot_drafts for insert
  with check (
    created_by = auth.uid()
    and (is_admin() or my_role() = 'Health Coach')
  );
create policy coach_copilot_drafts_update on coach_copilot_drafts for update
  using (created_by = auth.uid() and (is_admin() or my_role() = 'Health Coach'))
  with check (created_by = auth.uid() and (is_admin() or my_role() = 'Health Coach'));
-- No DELETE policy: discarded drafts remain in the audit trail.

do $$ begin
  begin execute 'alter publication supabase_realtime add table coach_copilot_drafts'; exception when others then null; end;
end $$;

commit;
