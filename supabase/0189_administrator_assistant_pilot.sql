-- ============================================================================
-- Cureocity Assistant — Administrator deterministic governance-checklist
-- pilot. Run after 0186_staff_assistant_policy_foundation.sql.
--
-- Forward-only and default-off: this adds exact Administrator RPC contracts
-- to the shared draft/audit table. It does not enable a flag, seed data, call
-- an AI provider, read application records, or change an existing role pilot.
-- Apply in Development before setting
-- STAFF_COPILOT_ADMINISTRATOR_ENABLED=true.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Administrator Assistant pilot';
  end if;
end;
$$;

create or replace function create_administrator_assistant_draft(
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
  v_caution text := 'Static navigation and process orientation only. No client, clinical, finance, HR, staff, access, issue, message or other application record was read; nothing was changed, resolved, approved, assigned, configured, published, sent or deleted.';
begin
  if v_user_id is null or v_role <> 'Administrator' then
    raise exception 'Administrator checklist assistance requires the authenticated Administrator role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('access_governance', 'issue_governance', 'service_configuration_review', 'operational_oversight')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'administrator.governance_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs every persisted field from the allowlisted key.
  -- A caller cannot use this security-definer RPC to store names, record data,
  -- arbitrary instructions, evidence, or edited output.
  case p_workflow_key
    when 'access_governance' then
      v_title := 'Access governance checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Administrator', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Users & Roles', 'href', '/users', 'purpose', 'Open the existing staff access-management area for an independent authorized review.'),
          jsonb_build_object('label', 'Audit Log', 'href', '/audit', 'purpose', 'Open the existing audit trail for an independent authorized review.'),
          jsonb_build_object('label', 'Governance & Interop', 'href', '/compliance', 'purpose', 'Open the existing governance and interoperability area.')
        )
      );
      v_evidence := jsonb_build_array(
        'Users & Roles is an existing Administrator-visible destination at /users.',
        'Audit Log is an existing Administrator-visible destination at /audit.',
        'Governance & Interop is an existing Administrator-visible destination at /compliance.'
      );
      v_draft_text := E'Review this static access governance checklist:\n\n1. Open Users & Roles (/users) — Open the existing staff access-management area for an independent authorized review.\n2. Open Audit Log (/audit) — Open the existing audit trail for an independent authorized review.\n3. Open Governance & Interop (/compliance) — Open the existing governance and interoperability area.';
    when 'issue_governance' then
      v_title := 'Issue governance checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Administrator', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Issue Reports', 'href', '/issues', 'purpose', 'Open the existing application issue triage area.'),
          jsonb_build_object('label', 'Governance & Interop', 'href', '/compliance', 'purpose', 'Open the existing governance and interoperability area.'),
          jsonb_build_object('label', 'Audit Log', 'href', '/audit', 'purpose', 'Open the existing audit trail for an independent authorized review.')
        )
      );
      v_evidence := jsonb_build_array(
        'Issue Reports is an existing Administrator-visible destination at /issues.',
        'Governance & Interop is an existing Administrator-visible destination at /compliance.',
        'Audit Log is an existing Administrator-visible destination at /audit.'
      );
      v_draft_text := E'Review this static issue governance checklist:\n\n1. Open Issue Reports (/issues) — Open the existing application issue triage area.\n2. Open Governance & Interop (/compliance) — Open the existing governance and interoperability area.\n3. Open Audit Log (/audit) — Open the existing audit trail for an independent authorized review.';
    when 'service_configuration_review' then
      v_title := 'Service configuration review checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Administrator', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Packages', 'href', '/packages', 'purpose', 'Open the existing package configuration area for an independent authorized review.'),
          jsonb_build_object('label', 'Services', 'href', '/services', 'purpose', 'Open the existing service configuration area for an independent authorized review.'),
          jsonb_build_object('label', 'Templates & Branding', 'href', '/templates', 'purpose', 'Open the existing template and branding area for an independent authorized review.')
        )
      );
      v_evidence := jsonb_build_array(
        'Packages is an existing Administrator-visible destination at /packages.',
        'Services is an existing Administrator-visible destination at /services.',
        'Templates & Branding is an existing Administrator-visible destination at /templates.'
      );
      v_draft_text := E'Review this static service configuration review checklist:\n\n1. Open Packages (/packages) — Open the existing package configuration area for an independent authorized review.\n2. Open Services (/services) — Open the existing service configuration area for an independent authorized review.\n3. Open Templates & Branding (/templates) — Open the existing template and branding area for an independent authorized review.';
    when 'operational_oversight' then
      v_title := 'Operational oversight checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Administrator', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Onboarding', 'href', '/onboarding', 'purpose', 'Open the existing onboarding area for an independent authorized review.'),
          jsonb_build_object('label', 'Follow-ups', 'href', '/followups', 'purpose', 'Open the existing follow-up area for an independent authorized review.'),
          jsonb_build_object('label', 'Retention', 'href', '/retention', 'purpose', 'Open the existing retention area for an independent authorized review.')
        )
      );
      v_evidence := jsonb_build_array(
        'Onboarding is an existing Administrator-visible destination at /onboarding.',
        'Follow-ups is an existing Administrator-visible destination at /followups.',
        'Retention is an existing Administrator-visible destination at /retention.'
      );
      v_draft_text := E'Review this static operational oversight checklist:\n\n1. Open Onboarding (/onboarding) — Open the existing onboarding area for an independent authorized review.\n2. Open Follow-ups (/followups) — Open the existing follow-up area for an independent authorized review.\n3. Open Retention (/retention) — Open the existing retention area for an independent authorized review.';
  end case;

  v_draft_text := v_draft_text
    || E'\n\nAt each destination, independently verify the real current state, your permission and the approved Cureocity process before doing anything in that page.'
    || E'\nIf the page, permission or process differs from this checklist, stop and escalate through the approved governance path. The Assistant has not inspected any record and cannot confirm that an issue, user, package, service, onboarding item, follow-up or retention item exists or is complete.';

  select coalesce(nullif(btrim(name), ''), 'Administrator user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Administrator profile could not be resolved'; end if;

  insert into staff_assistant_drafts (
    role_name, task_key, policy_version, task_version, action_tier,
    execution_mode, data_classifications, staff_instruction, context_snapshot,
    model_name, title, draft_text, evidence, caution, created_by, creator_name
  ) values (
    'Administrator', 'governance_checklist', p_policy_version, p_task_version, 1,
    'deterministic', array['Public application metadata', 'Internal operational'],
    p_workflow_key, v_context_snapshot, null, v_title, v_draft_text, v_evidence,
    v_caution, v_user_id, v_actor_name
  ) returning id into v_id;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft generated',
    'Administrator · governance_checklist',
    'Policy 2026-08-17.1; task administrator.governance_checklist.v1; deterministic static-route review draft only; no record read or action executed'
  );

  return v_id;
end;
$$;

create or replace function accept_administrator_assistant_draft(p_draft_id uuid)
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
  if v_user_id is null or v_role <> 'Administrator' then
    raise exception 'Administrator checklist assistance requires the authenticated Administrator role';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Administrator user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Administrator profile could not be resolved'; end if;

  update staff_assistant_drafts set
    status = 'Accepted',
    accepted_text = draft_text,
    accepted_by = v_user_id,
    accepted_by_name = v_actor_name,
    accepted_at = now()
  where id = p_draft_id
    and role_name = 'Administrator'
    and task_key = 'governance_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft accepted',
    'Administrator · governance_checklist',
    'Immutable generated checklist stored as reviewed working text only; no record read or action executed'
  );
  return true;
end;
$$;

create or replace function discard_administrator_assistant_draft(p_draft_id uuid)
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
  if v_user_id is null or v_role <> 'Administrator' then
    raise exception 'Administrator checklist assistance requires the authenticated Administrator role';
  end if;
  select coalesce(nullif(btrim(name), ''), 'Administrator user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Administrator profile could not be resolved'; end if;

  update staff_assistant_drafts set status = 'Discarded'
  where id = p_draft_id
    and role_name = 'Administrator'
    and task_key = 'governance_checklist'
    and created_by = v_user_id
    and status = 'Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (
    v_user_id, v_actor_name, v_role,
    'Cureocity Assistant draft discarded',
    'Administrator · governance_checklist',
    'No record read or action executed'
  );
  return true;
end;
$$;

revoke all on function create_administrator_assistant_draft(text, text, text) from public, anon;
revoke all on function accept_administrator_assistant_draft(uuid) from public, anon;
revoke all on function discard_administrator_assistant_draft(uuid) from public, anon;
grant execute on function create_administrator_assistant_draft(text, text, text) to authenticated;
grant execute on function accept_administrator_assistant_draft(uuid) to authenticated;
grant execute on function discard_administrator_assistant_draft(uuid) to authenticated;

commit;
