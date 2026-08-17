-- ============================================================================
-- Cureocity Assistant — Manager deterministic operations-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql.
--
-- Forward-only and default-off: adds exact Manager RPC contracts to the shared
-- draft/audit table. It does not enable a flag, seed data, call AI, read
-- application records, or change an existing role pilot. Apply in Development
-- before setting STAFF_COPILOT_MANAGER_ENABLED=true.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Manager Assistant pilot';
  end if;
end;
$$;

create or replace function create_manager_assistant_draft(
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
  v_caution text := 'Static navigation and process orientation only. No client, clinical, coach, appointment, session, finance, HR, staff, access, message or other application record was read; nothing was assigned, scheduled, changed, approved, completed, configured, published, sent or deleted.';
begin
  if v_user_id is null or v_role <> 'Manager' then
    raise exception 'Manager checklist assistance requires the authenticated Manager role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('coverage_coordination', 'coach_quality_review', 'onboarding_handover', 'service_operations_review')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'manager.operations_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs every persisted field from the allowlisted key.
  -- Callers cannot store names, record data, arbitrary instructions, evidence,
  -- or edited output through this security-definer RPC.
  case p_workflow_key
    when 'coverage_coordination' then
      v_title := 'Coverage coordination checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Manager', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Appointment Calendar', 'href', '/appointments', 'purpose', 'Open the existing appointment calendar for an independent authorized review.'),
          jsonb_build_object('label', 'Training Schedule', 'href', '/sessions', 'purpose', 'Open the existing training schedule for an independent authorized review.'),
          jsonb_build_object('label', 'Follow-ups', 'href', '/followups', 'purpose', 'Open the existing follow-up area for an independent authorized review.')
        )
      );
      v_evidence := jsonb_build_array(
        'Appointment Calendar is an existing Manager-visible destination at /appointments.',
        'Training Schedule is an existing Manager-visible destination at /sessions.',
        'Follow-ups is an existing Manager-visible destination at /followups.'
      );
      v_draft_text := E'Review this static coverage coordination checklist:\n\n1. Open Appointment Calendar (/appointments) — Open the existing appointment calendar for an independent authorized review.\n2. Open Training Schedule (/sessions) — Open the existing training schedule for an independent authorized review.\n3. Open Follow-ups (/followups) — Open the existing follow-up area for an independent authorized review.';
    when 'coach_quality_review' then
      v_title := 'Coach quality review checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Manager', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Coach Quality', 'href', '/workspace', 'purpose', 'Open the Manager''s existing Coach Quality oversight workspace.'),
          jsonb_build_object('label', 'Care Team', 'href', '/careteam', 'purpose', 'Open the existing care-team coordination area for an independent authorized review.'),
          jsonb_build_object('label', 'Governance & Interop', 'href', '/compliance', 'purpose', 'Open the existing governance and interoperability area.')
        )
      );
      v_evidence := jsonb_build_array(
        'Coach Quality is an existing Manager-visible destination at /workspace.',
        'Care Team is an existing Manager-visible destination at /careteam.',
        'Governance & Interop is an existing Manager-visible destination at /compliance.'
      );
      v_draft_text := E'Review this static coach quality review checklist:\n\n1. Open Coach Quality (/workspace) — Open the Manager''s existing Coach Quality oversight workspace.\n2. Open Care Team (/careteam) — Open the existing care-team coordination area for an independent authorized review.\n3. Open Governance & Interop (/compliance) — Open the existing governance and interoperability area.';
    when 'onboarding_handover' then
      v_title := 'Onboarding handover checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Manager', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Clients', 'href', '/clients', 'purpose', 'Open the existing client index for an independent authorized review.'),
          jsonb_build_object('label', 'Onboarding', 'href', '/onboarding', 'purpose', 'Open the existing onboarding area for an independent authorized review.'),
          jsonb_build_object('label', 'Follow-ups', 'href', '/followups', 'purpose', 'Open the existing follow-up area for an independent authorized review.')
        )
      );
      v_evidence := jsonb_build_array(
        'Clients is an existing Manager-visible destination at /clients.',
        'Onboarding is an existing Manager-visible destination at /onboarding.',
        'Follow-ups is an existing Manager-visible destination at /followups.'
      );
      v_draft_text := E'Review this static onboarding handover checklist:\n\n1. Open Clients (/clients) — Open the existing client index for an independent authorized review.\n2. Open Onboarding (/onboarding) — Open the existing onboarding area for an independent authorized review.\n3. Open Follow-ups (/followups) — Open the existing follow-up area for an independent authorized review.';
    when 'service_operations_review' then
      v_title := 'Service operations review checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Manager', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Packages', 'href', '/packages', 'purpose', 'Open the existing package area for an independent authorized review.'),
          jsonb_build_object('label', 'Services', 'href', '/services', 'purpose', 'Open the existing service area for an independent authorized review.'),
          jsonb_build_object('label', 'Templates & Branding', 'href', '/templates', 'purpose', 'Open the existing template and branding area for an independent authorized review.')
        )
      );
      v_evidence := jsonb_build_array(
        'Packages is an existing Manager-visible destination at /packages.',
        'Services is an existing Manager-visible destination at /services.',
        'Templates & Branding is an existing Manager-visible destination at /templates.'
      );
      v_draft_text := E'Review this static service operations review checklist:\n\n1. Open Packages (/packages) — Open the existing package area for an independent authorized review.\n2. Open Services (/services) — Open the existing service area for an independent authorized review.\n3. Open Templates & Branding (/templates) — Open the existing template and branding area for an independent authorized review.';
  end case;

  v_draft_text := v_draft_text
    || E'\n\nAt each destination, independently verify the real current state, your permission, ownership and the approved Cureocity process before taking any action in that page.'
    || E'\nIf the page, permission, ownership or process differs from this checklist, stop and escalate through the approved management path. The Assistant has not inspected any record and cannot confirm that a client, appointment, session, follow-up, handover, quality item, package, service or template exists or is complete.';

  select coalesce(nullif(btrim(name), ''), 'Manager user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Manager profile could not be resolved'; end if;

  insert into staff_assistant_drafts (
    role_name, task_key, policy_version, task_version, action_tier,
    execution_mode, data_classifications, staff_instruction, context_snapshot,
    model_name, title, draft_text, evidence, caution, created_by, creator_name
  ) values (
    'Manager', 'operations_checklist', p_policy_version, p_task_version, 1,
    'deterministic', array['Public application metadata', 'Internal operational'],
    p_workflow_key, v_context_snapshot, null, v_title, v_draft_text, v_evidence,
    v_caution, v_user_id, v_actor_name
  ) returning id into v_id;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft generated',
    'Manager · operations_checklist',
    'Policy 2026-08-17.1; task manager.operations_checklist.v1; deterministic static-route review draft only; no record read or action executed'
  );
  return v_id;
end;
$$;

create or replace function accept_manager_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := my_role();
  v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Manager' then raise exception 'Manager checklist assistance requires the authenticated Manager role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Manager user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Manager profile could not be resolved'; end if;
  update staff_assistant_drafts set
    status = 'Accepted', accepted_text = draft_text, accepted_by = v_user_id,
    accepted_by_name = v_actor_name, accepted_at = now()
  where id = p_draft_id and role_name = 'Manager' and task_key = 'operations_checklist'
    and created_by = v_user_id and status = 'Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;
  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft accepted', 'Manager · operations_checklist', 'Immutable generated checklist stored as reviewed working text only; no record read or action executed');
  return true;
end;
$$;

create or replace function discard_manager_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := my_role();
  v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Manager' then raise exception 'Manager checklist assistance requires the authenticated Manager role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Manager user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Manager profile could not be resolved'; end if;
  update staff_assistant_drafts set status = 'Discarded'
  where id = p_draft_id and role_name = 'Manager' and task_key = 'operations_checklist'
    and created_by = v_user_id and status = 'Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;
  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft discarded', 'Manager · operations_checklist', 'No record read or action executed');
  return true;
end;
$$;

revoke all on function create_manager_assistant_draft(text, text, text) from public, anon;
revoke all on function accept_manager_assistant_draft(uuid) from public, anon;
revoke all on function discard_manager_assistant_draft(uuid) from public, anon;
grant execute on function create_manager_assistant_draft(text, text, text) to authenticated;
grant execute on function accept_manager_assistant_draft(uuid) to authenticated;
grant execute on function discard_manager_assistant_draft(uuid) to authenticated;

commit;
