-- ============================================================================
-- Cureocity Assistant — Fitness Trainer deterministic workspace-checklist
-- pilot. Run after 0186_staff_assistant_policy_foundation.sql.
--
-- Forward-only and default-off: this adds exact Fitness Trainer RPC contracts
-- to the shared draft/audit table. It does not enable a flag, seed data, call
-- an AI provider, read application records, or change an existing role pilot.
-- Apply in Development before setting
-- STAFF_COPILOT_FITNESS_TRAINER_ENABLED=true.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Fitness Trainer Assistant pilot';
  end if;
end;
$$;

create or replace function create_fitness_trainer_assistant_draft(
  p_workflow_key text,
  p_policy_version text,
  p_task_version text
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
  v_title text;
  v_draft_text text;
  v_evidence jsonb;
  v_context_snapshot jsonb;
  v_caution text := 'Static navigation and process orientation only. No client, clinical, assessment, workout, session, finance, HR, staff or message record was read; nothing was prescribed, scheduled, completed, changed, submitted, published or sent.';
begin
  if v_user_id is null or v_role <> 'Fitness Trainer' then
    raise exception 'Fitness Trainer checklist assistance requires the authenticated Fitness Trainer role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('today_and_roster', 'session_coordination', 'workout_planning', 'summary_and_handoff')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'fitness_trainer.operational_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs every persisted field from the allowlisted key.
  -- A caller cannot use this security-definer RPC to store names, record data,
  -- arbitrary instructions, evidence, or edited output.
  case p_workflow_key
    when 'today_and_roster' then
      v_title := 'Today and roster workspace checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Fitness Trainer', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Today', 'href', '/workspace?role=trainer&tab=dash', 'purpose', 'Open the Fitness Trainer Today tab.'),
          jsonb_build_object('label', 'My clients', 'href', '/workspace?role=trainer&tab=clients', 'purpose', 'Open the Fitness Trainer roster tab.')
        )
      );
      v_evidence := jsonb_build_array(
        'Today is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=dash.',
        'My clients is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=clients.'
      );
      v_draft_text := E'Review this static today and roster checklist:\n\n1. Open Today (/workspace?role=trainer&tab=dash) — Open the Fitness Trainer Today tab.\n2. Open My clients (/workspace?role=trainer&tab=clients) — Open the Fitness Trainer roster tab.';
    when 'session_coordination' then
      v_title := 'Session coordination workspace checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Fitness Trainer', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Appointments', 'href', '/workspace?role=trainer&tab=appts', 'purpose', 'Open the trainer workspace Appointments tab.'),
          jsonb_build_object('label', 'Training Schedule', 'href', '/sessions', 'purpose', 'Open the shared training schedule.')
        )
      );
      v_evidence := jsonb_build_array(
        'Appointments is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=appts.',
        'Training Schedule is an existing Fitness Trainer-visible workspace destination at /sessions.'
      );
      v_draft_text := E'Review this static session coordination checklist:\n\n1. Open Appointments (/workspace?role=trainer&tab=appts) — Open the trainer workspace Appointments tab.\n2. Open Training Schedule (/sessions) — Open the shared training schedule.';
    when 'workout_planning' then
      v_title := 'Workout planning workspace checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Fitness Trainer', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Workout planner', 'href', '/workspace?role=trainer&tab=planner', 'purpose', 'Open the Fitness Trainer workout-planner tab.'),
          jsonb_build_object('label', 'Exercise library', 'href', '/workspace?role=trainer&tab=exlib', 'purpose', 'Open the Fitness Trainer exercise-library tab.')
        )
      );
      v_evidence := jsonb_build_array(
        'Workout planner is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=planner.',
        'Exercise library is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=exlib.'
      );
      v_draft_text := E'Review this static workout planning checklist:\n\n1. Open Workout planner (/workspace?role=trainer&tab=planner) — Open the Fitness Trainer workout-planner tab.\n2. Open Exercise library (/workspace?role=trainer&tab=exlib) — Open the Fitness Trainer exercise-library tab.';
    when 'summary_and_handoff' then
      v_title := 'Summary and team handoff workspace checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Fitness Trainer', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Summaries', 'href', '/workspace?role=trainer&tab=summaries', 'purpose', 'Open the Fitness Trainer Summaries tab.'),
          jsonb_build_object('label', 'Concerns', 'href', '/workspace?role=trainer&tab=concerns', 'purpose', 'Open the Fitness Trainer Concerns tab.'),
          jsonb_build_object('label', 'MDT board', 'href', '/workspace?role=trainer&tab=board', 'purpose', 'Open the Fitness Trainer MDT board tab.')
        )
      );
      v_evidence := jsonb_build_array(
        'Summaries is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=summaries.',
        'Concerns is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=concerns.',
        'MDT board is an existing Fitness Trainer-visible workspace destination at /workspace?role=trainer&tab=board.'
      );
      v_draft_text := E'Review this static summary and team handoff checklist:\n\n1. Open Summaries (/workspace?role=trainer&tab=summaries) — Open the Fitness Trainer Summaries tab.\n2. Open Concerns (/workspace?role=trainer&tab=concerns) — Open the Fitness Trainer Concerns tab.\n3. Open MDT board (/workspace?role=trainer&tab=board) — Open the Fitness Trainer MDT board tab.';
  end case;

  v_draft_text := v_draft_text
    || E'\n\nAt each destination, independently verify the relevant item, assignment, permission, safety state and current status from the page before following the approved Cureocity process.'
    || E'\nIf the workspace, permission or process differs from this checklist, stop and ask a Manager or appropriate clinical supervisor. The Assistant has not inspected any record and cannot confirm that work exists, is safe, is eligible, or is complete.';

  select coalesce(nullif(btrim(name), ''), 'Fitness Trainer user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Fitness Trainer profile could not be resolved'; end if;

  insert into staff_assistant_drafts (
    role_name, task_key, policy_version, task_version, action_tier,
    execution_mode, data_classifications, staff_instruction, context_snapshot,
    model_name, title, draft_text, evidence, caution, created_by, creator_name
  ) values (
    'Fitness Trainer', 'operational_checklist', p_policy_version, p_task_version, 1,
    'deterministic', array['Public application metadata', 'Internal operational'],
    p_workflow_key, v_context_snapshot, null, v_title, v_draft_text, v_evidence,
    v_caution, v_user_id, v_actor_name
  ) returning id into v_id;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft generated',
    'Fitness Trainer · operational_checklist',
    'Policy 2026-08-17.1; task fitness_trainer.operational_checklist.v1; deterministic static-workspace review draft only; no record read or action executed'
  );

  return v_id;
end;
$$;

create or replace function accept_fitness_trainer_assistant_draft(p_draft_id uuid)
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
  if v_user_id is null or v_role <> 'Fitness Trainer' then
    raise exception 'Fitness Trainer checklist assistance requires the authenticated Fitness Trainer role';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Fitness Trainer user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Fitness Trainer profile could not be resolved'; end if;

  update staff_assistant_drafts set
    status = 'Accepted',
    accepted_text = draft_text,
    accepted_by = v_user_id,
    accepted_by_name = v_actor_name,
    accepted_at = now()
  where id = p_draft_id
    and role_name = 'Fitness Trainer'
    and task_key = 'operational_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft accepted',
    'Fitness Trainer · operational_checklist',
    'Immutable generated checklist stored as reviewed working text only; no record read or action executed'
  );
  return true;
end;
$$;

create or replace function discard_fitness_trainer_assistant_draft(p_draft_id uuid)
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
  if v_user_id is null or v_role <> 'Fitness Trainer' then
    raise exception 'Fitness Trainer checklist assistance requires the authenticated Fitness Trainer role';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Fitness Trainer user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Fitness Trainer profile could not be resolved'; end if;

  update staff_assistant_drafts set status = 'Discarded'
  where id = p_draft_id
    and role_name = 'Fitness Trainer'
    and task_key = 'operational_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft discarded',
    'Fitness Trainer · operational_checklist',
    'No record read or action executed'
  );
  return true;
end;
$$;

revoke all on function create_fitness_trainer_assistant_draft(text, text, text) from public, anon;
revoke all on function accept_fitness_trainer_assistant_draft(uuid) from public, anon;
revoke all on function discard_fitness_trainer_assistant_draft(uuid) from public, anon;
grant execute on function create_fitness_trainer_assistant_draft(text, text, text) to authenticated;
grant execute on function accept_fitness_trainer_assistant_draft(uuid) to authenticated;
grant execute on function discard_fitness_trainer_assistant_draft(uuid) to authenticated;

commit;
