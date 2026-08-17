-- ============================================================================
-- Cureocity Assistant — Front Desk deterministic operational-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql.
--
-- Forward-only and default-off: this adds exact Front Desk RPC contracts to the
-- shared draft/audit table. It does not enable a flag, seed data, call an AI
-- provider, read operational records, or change an existing role pilot. Apply
-- in Development before setting STAFF_COPILOT_FRONT_DESK_ENABLED=true.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Front Desk Assistant pilot';
  end if;
end;
$$;

create or replace function create_front_desk_assistant_draft(
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
  v_caution text := 'Static navigation and process orientation only. No client, clinical, finance, HR, staff, appointment or message record was read; nothing was contacted, scheduled, changed, submitted or completed.';
begin
  if v_user_id is null or v_role <> 'Front Desk' then
    raise exception 'Front Desk checklist assistance requires the authenticated Front Desk role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('lead_intake', 'client_onboarding', 'appointment_coordination', 'follow_up_queue')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'front_desk.operational_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs every persisted field from the allowlisted key.
  -- A caller cannot use this security-definer RPC to store names, record data,
  -- arbitrary instructions, evidence, or edited output.
  case p_workflow_key
    when 'lead_intake' then
      v_title := 'Lead intake navigation checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Front Desk', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'CRM & Leads', 'href', '/leads', 'purpose', 'Open the lead work area.'),
          jsonb_build_object('label', 'Tablet Intake', 'href', '/intake', 'purpose', 'Open the intake work area.')
        )
      );
      v_evidence := jsonb_build_array(
        'CRM & Leads is an existing Front Desk-visible route at /leads.',
        'Tablet Intake is an existing Front Desk-visible route at /intake.'
      );
      v_draft_text := E'Review this static lead intake checklist:\n\n1. Open CRM & Leads (/leads) — Open the lead work area.\n2. Open Tablet Intake (/intake) — Open the intake work area.';
    when 'client_onboarding' then
      v_title := 'Client onboarding navigation checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Front Desk', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Clients', 'href', '/clients', 'purpose', 'Open the client roster and its Onboarding tab.'),
          jsonb_build_object('label', 'Onboarding', 'href', '/onboarding', 'purpose', 'Open the Front Desk onboarding view.'),
          jsonb_build_object('label', 'Forms & Consent', 'href', '/forms', 'purpose', 'Open the forms and consent area.')
        )
      );
      v_evidence := jsonb_build_array(
        'Clients is an existing Front Desk-visible route at /clients.',
        'Onboarding is an existing Front Desk-visible route at /onboarding.',
        'Forms & Consent is an existing Front Desk-visible route at /forms.'
      );
      v_draft_text := E'Review this static client onboarding checklist:\n\n1. Open Clients (/clients) — Open the client roster and its Onboarding tab.\n2. Open Onboarding (/onboarding) — Open the Front Desk onboarding view.\n3. Open Forms & Consent (/forms) — Open the forms and consent area.';
    when 'appointment_coordination' then
      v_title := 'Appointment coordination navigation checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Front Desk', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Appointment Calendar', 'href', '/appointments', 'purpose', 'Open the appointment calendar.'),
          jsonb_build_object('label', 'Training Schedule', 'href', '/sessions', 'purpose', 'Open the strength-session schedule.')
        )
      );
      v_evidence := jsonb_build_array(
        'Appointment Calendar is an existing Front Desk-visible route at /appointments.',
        'Training Schedule is an existing Front Desk-visible route at /sessions.'
      );
      v_draft_text := E'Review this static appointment coordination checklist:\n\n1. Open Appointment Calendar (/appointments) — Open the appointment calendar.\n2. Open Training Schedule (/sessions) — Open the strength-session schedule.';
    when 'follow_up_queue' then
      v_title := 'Follow-up and retention navigation checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Front Desk', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Follow-ups', 'href', '/followups', 'purpose', 'Open the follow-up queue.'),
          jsonb_build_object('label', 'Retention', 'href', '/retention', 'purpose', 'Open the retention work area.')
        )
      );
      v_evidence := jsonb_build_array(
        'Follow-ups is an existing Front Desk-visible route at /followups.',
        'Retention is an existing Front Desk-visible route at /retention.'
      );
      v_draft_text := E'Review this static follow-up and retention checklist:\n\n1. Open Follow-ups (/followups) — Open the follow-up queue.\n2. Open Retention (/retention) — Open the retention work area.';
  end case;

  v_draft_text := v_draft_text
    || E'\n\nAt each destination, independently verify the relevant item, ownership, permissions and current state from the page before proceeding under the approved Cureocity process.'
    || E'\nIf the page, permission or process differs from this route checklist, stop and ask a Manager. The Assistant has not inspected any record and cannot confirm that work exists, is eligible, or is complete.';

  select coalesce(nullif(btrim(name), ''), 'Front Desk user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Front Desk profile could not be resolved'; end if;

  insert into staff_assistant_drafts (
    role_name, task_key, policy_version, task_version, action_tier,
    execution_mode, data_classifications, staff_instruction, context_snapshot,
    model_name, title, draft_text, evidence, caution, created_by, creator_name
  ) values (
    'Front Desk', 'operational_checklist', p_policy_version, p_task_version, 1,
    'deterministic', array['Public application metadata', 'Internal operational'],
    p_workflow_key, v_context_snapshot, null, v_title, v_draft_text, v_evidence,
    v_caution, v_user_id, v_actor_name
  ) returning id into v_id;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft generated',
    'Front Desk · operational_checklist',
    'Policy 2026-08-17.1; task front_desk.operational_checklist.v1; deterministic static-route review draft only; no record read or action executed'
  );

  return v_id;
end;
$$;

create or replace function accept_front_desk_assistant_draft(p_draft_id uuid)
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
  if v_user_id is null or v_role <> 'Front Desk' then
    raise exception 'Front Desk checklist assistance requires the authenticated Front Desk role';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Front Desk user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Front Desk profile could not be resolved'; end if;

  update staff_assistant_drafts set
    status = 'Accepted',
    accepted_text = draft_text,
    accepted_by = v_user_id,
    accepted_by_name = v_actor_name,
    accepted_at = now()
  where id = p_draft_id
    and role_name = 'Front Desk'
    and task_key = 'operational_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft accepted',
    'Front Desk · operational_checklist',
    'Immutable generated checklist stored as reviewed working text only; no record read or action executed'
  );
  return true;
end;
$$;

create or replace function discard_front_desk_assistant_draft(p_draft_id uuid)
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
  if v_user_id is null or v_role <> 'Front Desk' then
    raise exception 'Front Desk checklist assistance requires the authenticated Front Desk role';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Front Desk user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Front Desk profile could not be resolved'; end if;

  update staff_assistant_drafts set status = 'Discarded'
  where id = p_draft_id
    and role_name = 'Front Desk'
    and task_key = 'operational_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft discarded',
    'Front Desk · operational_checklist',
    'No record read or action executed'
  );
  return true;
end;
$$;

revoke all on function create_front_desk_assistant_draft(text, text, text) from public, anon;
revoke all on function accept_front_desk_assistant_draft(uuid) from public, anon;
revoke all on function discard_front_desk_assistant_draft(uuid) from public, anon;
grant execute on function create_front_desk_assistant_draft(text, text, text) to authenticated;
grant execute on function accept_front_desk_assistant_draft(uuid) to authenticated;
grant execute on function discard_front_desk_assistant_draft(uuid) to authenticated;

commit;
