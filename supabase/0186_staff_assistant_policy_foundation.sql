-- ============================================================================
-- Cureocity Assistant — shared versioned draft/audit foundation + Staff
-- navigation-checklist pilot. Run after 0185.
--
-- Forward-only and default-off: this creates storage/RPC contracts but does not
-- enable a feature flag, call an AI provider, read application records, seed a
-- draft, or change an existing pilot. Apply in Development before setting
-- STAFF_COPILOT_STAFF_ENABLED=true. Do not enable in Production without the
-- PRD release gates and a controlled smoke test.
-- ============================================================================

begin;

create table if not exists staff_assistant_drafts (
  id                   uuid primary key default gen_random_uuid(),
  role_name            text not null check (role_name in (
                           'Super Admin', 'Administrator', 'Manager', 'Medical Director',
                           'Front Desk', 'Doctor', 'Dietitian', 'Fitness Trainer',
                           'Health Coach', 'Psychologist', 'Finance', 'HR', 'Staff'
                         )),
  task_key             text not null,
  policy_version       text not null,
  task_version         text not null,
  action_tier          smallint not null check (action_tier between 0 and 2),
  execution_mode       text not null check (execution_mode in ('deterministic', 'guarded_ai')),
  data_classifications text[] not null default '{}',
  staff_instruction    text,
  context_snapshot     jsonb not null check (jsonb_typeof(context_snapshot) = 'object'),
  model_name           text,
  title                text not null,
  draft_text           text not null,
  evidence             jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  caution              text,
  status               text not null default 'Draft' check (status in ('Draft', 'Accepted', 'Discarded')),
  created_by           uuid not null default auth.uid(),
  creator_name         text not null,
  created_at           timestamptz not null default now(),
  accepted_text        text,
  accepted_by          uuid,
  accepted_by_name     text,
  accepted_at          timestamptz,
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

create index if not exists staff_assistant_drafts_owner_idx
  on staff_assistant_drafts (created_by, role_name, created_at desc);
create index if not exists staff_assistant_drafts_task_idx
  on staff_assistant_drafts (role_name, task_key, status, created_at desc);

create or replace function guard_staff_assistant_draft()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.role_name is distinct from new.role_name
     or old.task_key is distinct from new.task_key
     or old.policy_version is distinct from new.policy_version
     or old.task_version is distinct from new.task_version
     or old.action_tier is distinct from new.action_tier
     or old.execution_mode is distinct from new.execution_mode
     or old.data_classifications is distinct from new.data_classifications
     or old.staff_instruction is distinct from new.staff_instruction
     or old.context_snapshot is distinct from new.context_snapshot
     or old.model_name is distinct from new.model_name
     or old.title is distinct from new.title
     or old.draft_text is distinct from new.draft_text
     or old.evidence is distinct from new.evidence
     or old.caution is distinct from new.caution
     or old.created_by is distinct from new.created_by
     or old.creator_name is distinct from new.creator_name
     or old.created_at is distinct from new.created_at then
    raise exception 'Generated Cureocity Assistant evidence is immutable';
  end if;
  if old.status <> 'Draft' then
    raise exception 'A completed Cureocity Assistant review cannot be changed';
  end if;
  if new.status not in ('Accepted', 'Discarded') then
    raise exception 'A Cureocity Assistant draft may only be accepted or discarded';
  end if;
  if new.status = 'Accepted' and new.accepted_by is distinct from auth.uid() then
    raise exception 'Cureocity Assistant acceptance must be attributed to the current user';
  end if;
  if new.status = 'Discarded' and (
    new.accepted_text is not null or new.accepted_by is not null
    or new.accepted_by_name is not null or new.accepted_at is not null
  ) then
    raise exception 'A discarded Cureocity Assistant draft cannot contain acceptance details';
  end if;
  return new;
end;
$$;

drop trigger if exists staff_assistant_draft_guard on staff_assistant_drafts;
create trigger staff_assistant_draft_guard
before update on staff_assistant_drafts
for each row execute function guard_staff_assistant_draft();

alter table staff_assistant_drafts enable row level security;

drop policy if exists staff_assistant_drafts_read_own on staff_assistant_drafts;
create policy staff_assistant_drafts_read_own on staff_assistant_drafts for select
  using (
    auth.uid() is not null
    and created_by = auth.uid()
    and role_name = my_role()
    and my_role() <> 'Client'
  );

-- Writes are deliberately RPC-only so draft + audit always commit together.
revoke all on table staff_assistant_drafts from anon, authenticated;
grant select on table staff_assistant_drafts to authenticated;

create or replace function create_staff_assistant_draft(
  p_task_key text,
  p_policy_version text,
  p_task_version text,
  p_staff_instruction text,
  p_context_snapshot jsonb,
  p_title text,
  p_draft_text text,
  p_evidence jsonb,
  p_caution text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := my_role();
  v_actor_name text;
  v_id uuid;
begin
  if v_user_id is null or v_role <> 'Staff' then
    raise exception 'Staff navigation assistance requires the authenticated Staff role';
  end if;
  if p_task_key <> 'navigation_checklist'
     or p_policy_version <> '2026-08-17.1'
     or p_task_version <> 'staff.navigation_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;
  if nullif(btrim(p_staff_instruction), '') is null or length(p_staff_instruction) > 500 then
    raise exception 'Invalid Staff navigation request';
  end if;
  if jsonb_typeof(p_context_snapshot) <> 'object'
     or p_context_snapshot->>'role' <> 'Staff'
     or octet_length(p_context_snapshot::text) > 20000 then
    raise exception 'Invalid Staff navigation context';
  end if;
  if nullif(btrim(p_title), '') is null or length(p_title) > 120
     or nullif(btrim(p_draft_text), '') is null or length(p_draft_text) > 6000
     or jsonb_typeof(p_evidence) <> 'array' or jsonb_array_length(p_evidence) > 5
     or length(coalesce(p_caution, '')) > 600 then
    raise exception 'Invalid Staff navigation draft';
  end if;

  select coalesce(nullif(btrim(name), ''), 'Staff user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Staff profile could not be resolved'; end if;

  insert into staff_assistant_drafts (
    role_name, task_key, policy_version, task_version, action_tier,
    execution_mode, data_classifications, staff_instruction, context_snapshot,
    model_name, title, draft_text, evidence, caution, created_by, creator_name
  ) values (
    'Staff', 'navigation_checklist', p_policy_version, p_task_version, 1,
    'deterministic', array['Public application metadata'], p_staff_instruction,
    p_context_snapshot, null, p_title, p_draft_text, p_evidence, p_caution,
    v_user_id, v_actor_name
  ) returning id into v_id;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft generated',
    'Staff · navigation_checklist',
    'Policy 2026-08-17.1; task staff.navigation_checklist.v1; deterministic review draft only; no action executed'
  );

  return v_id;
end;
$$;

create or replace function accept_staff_assistant_draft(p_draft_id uuid, p_accepted_text text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := my_role();
  v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Staff' then
    raise exception 'Staff navigation assistance requires the authenticated Staff role';
  end if;
  if nullif(btrim(p_accepted_text), '') is null or length(p_accepted_text) > 6000 then
    raise exception 'Invalid reviewed navigation text';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Staff user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Staff profile could not be resolved'; end if;

  update staff_assistant_drafts set
    status = 'Accepted',
    accepted_text = btrim(p_accepted_text),
    accepted_by = v_user_id,
    accepted_by_name = v_actor_name,
    accepted_at = now()
  where id = p_draft_id
    and role_name = 'Staff'
    and task_key = 'navigation_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft accepted',
    'Staff · navigation_checklist',
    'Reviewed working text stored only; no navigation or record action executed'
  );
  return true;
end;
$$;

create or replace function discard_staff_assistant_draft(p_draft_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := my_role();
  v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Staff' then
    raise exception 'Staff navigation assistance requires the authenticated Staff role';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Staff user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Staff profile could not be resolved'; end if;

  update staff_assistant_drafts set status = 'Discarded'
  where id = p_draft_id
    and role_name = 'Staff'
    and task_key = 'navigation_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft discarded',
    'Staff · navigation_checklist',
    'No action executed'
  );
  return true;
end;
$$;

revoke execute on function guard_staff_assistant_draft() from public, anon, authenticated;
revoke all on function create_staff_assistant_draft(text, text, text, text, jsonb, text, text, jsonb, text) from public, anon;
revoke all on function accept_staff_assistant_draft(uuid, text) from public, anon;
revoke all on function discard_staff_assistant_draft(uuid) from public, anon;
grant execute on function create_staff_assistant_draft(text, text, text, text, jsonb, text, text, jsonb, text) to authenticated;
grant execute on function accept_staff_assistant_draft(uuid, text) to authenticated;
grant execute on function discard_staff_assistant_draft(uuid) to authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table staff_assistant_drafts'; exception when others then null; end;
end $$;

commit;
