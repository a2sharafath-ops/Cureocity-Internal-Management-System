-- Cureocity Assistant — Psychologist deterministic workflow-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql. Forward-only and
-- default-off; apply in Development before setting
-- STAFF_COPILOT_PSYCHOLOGIST_ENABLED=true. No AI or application records used.

begin;

do $$
begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Psychologist Assistant pilot';
  end if;
end;
$$;

create or replace function create_psychologist_assistant_draft(
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
  v_caution text := 'Static navigation and process orientation only. No client, psychological, clinical, consultation, assessment, therapy-note, appointment, concern, safety, referral, finance, HR, staff or message record was read; nothing was diagnosed, interpreted, recommended, changed, submitted, escalated, closed, assigned, disclosed or sent.';
begin
  if v_user_id is null or v_role <> 'Psychologist' then
    raise exception 'Psychologist checklist assistance requires the authenticated Psychologist role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('daily_caseload_orientation', 'consultation_documentation', 'safety_and_concern_escalation', 'blueprint_and_mdt_handoff')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'psychologist.workflow_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs all persisted text from the allowlisted key.
  -- Callers cannot persist record data, arbitrary instructions, evidence, or
  -- edited output through this security-definer RPC.
  case p_workflow_key
    when 'daily_caseload_orientation' then
      v_title := 'Daily caseload orientation checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Psychologist', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Today', 'href', '/workspace?role=psych&tab=dash'),
          jsonb_build_object('label', 'My clients', 'href', '/workspace?role=psych&tab=clients'),
          jsonb_build_object('label', 'Appointments', 'href', '/workspace?role=psych&tab=appts')
        ),
        'checks', jsonb_build_array(
          'Verify date, assignment, appointment state and ownership in the destination page.',
          'Use the existing consultation workflow for booked counselling work.',
          'The Assistant does not prioritize, book, change or claim completion.'
        )
      );
      v_evidence := jsonb_build_array('Today, My clients and Appointments are existing Psychologist-visible workspace destinations.', 'Static orientation only; no record state is asserted.');
      v_draft_text := E'Review this static daily caseload orientation checklist:\n\n1. Open Today (/workspace?role=psych&tab=dash).\n2. Open My clients (/workspace?role=psych&tab=clients).\n3. Open Appointments (/workspace?role=psych&tab=appts).\n\nVerify the current date, assignment, appointment state, ownership and approved workflow. The Assistant does not prioritize a person, book or change an appointment, or claim that work is due or complete.';
    when 'consultation_documentation' then
      v_title := 'Consultation documentation checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Psychologist', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'My clients', 'href', '/workspace?role=psych&tab=clients'),
          jsonb_build_object('label', 'Summaries', 'href', '/workspace?role=psych&tab=summaries'),
          jsonb_build_object('label', 'Resource library', 'href', '/workspace?role=psych&tab=library')
        ),
        'checks', jsonb_build_array(
          'Confirm the correct permitted client and consultation before documentation.',
          'Record only professionally reviewed content through the existing workflow.',
          'The Assistant does not read therapy notes, diagnose, interpret a score, recommend treatment or create a clinical summary.'
        )
      );
      v_evidence := jsonb_build_array('My clients, Summaries and Resource library are existing Psychologist-visible destinations.', 'Static documentation boundaries only; no note or assessment is read.');
      v_draft_text := E'Review this static consultation documentation checklist:\n\n1. Open My clients (/workspace?role=psych&tab=clients).\n2. Open Summaries (/workspace?role=psych&tab=summaries).\n3. Open Resource library (/workspace?role=psych&tab=library).\n\nConfirm the correct permitted client and consultation and record only professionally reviewed content. The Assistant does not read therapy notes, diagnose, interpret scores, recommend treatment or create a summary.';
    when 'safety_and_concern_escalation' then
      v_title := 'Safety and concern escalation checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Psychologist', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Concerns', 'href', '/workspace?role=psych&tab=concerns'),
          jsonb_build_object('label', 'Whiteboard', 'href', '/workspace?role=psych&tab=whiteboard'),
          jsonb_build_object('label', 'MDT board', 'href', '/workspace?role=psych&tab=board')
        ),
        'checks', jsonb_build_array(
          'Use the approved human-led safety escalation workflow without relying on this checklist.',
          'Verify urgency, ownership, consent, minimum-necessary disclosure and required clinical follow-up.',
          'The Assistant does not assess risk, provide crisis advice, close an item, create a referral, contact anyone or replace emergency procedures.'
        )
      );
      v_evidence := jsonb_build_array('Concerns, Whiteboard and MDT board are existing Psychologist-visible destinations.', 'Static safety boundaries explicitly prohibit risk assessment and closure.');
      v_draft_text := E'Review this static safety and concern escalation checklist:\n\n1. Open Concerns (/workspace?role=psych&tab=concerns).\n2. Open Whiteboard (/workspace?role=psych&tab=whiteboard).\n3. Open MDT board (/workspace?role=psych&tab=board).\n\nUse the approved human-led safety workflow and verify urgency, ownership, consent and minimum-necessary disclosure. The Assistant does not assess risk, provide crisis advice, close an item, create a referral, contact anyone or replace emergency procedures.';
    when 'blueprint_and_mdt_handoff' then
      v_title := 'BluePrint and MDT handoff checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Psychologist', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'BluePrint', 'href', '/workspace?role=psych&tab=bp'),
          jsonb_build_object('label', 'Summaries', 'href', '/workspace?role=psych&tab=summaries'),
          jsonb_build_object('label', 'MDT board', 'href', '/workspace?role=psych&tab=board')
        ),
        'checks', jsonb_build_array(
          'Verify the permitted client, purpose, ownership and minimum information required.',
          'Separate recorded facts from professional judgement and use the approved coordination workflow.',
          'The Assistant does not summarize records, disclose therapy content, create a handoff, assign a task or contact anyone.'
        )
      );
      v_evidence := jsonb_build_array('BluePrint, Summaries and MDT board are existing Psychologist-visible destinations.', 'Static handoff boundaries prohibit record summarization or disclosure.');
      v_draft_text := E'Review this static BluePrint and MDT handoff checklist:\n\n1. Open BluePrint (/workspace?role=psych&tab=bp).\n2. Open Summaries (/workspace?role=psych&tab=summaries).\n3. Open MDT board (/workspace?role=psych&tab=board).\n\nVerify the permitted client, purpose, ownership and minimum information required. Separate facts from professional judgement. The Assistant does not summarize records, disclose therapy content, create a handoff, assign a task or contact anyone.';
  end case;

  v_draft_text := v_draft_text
    || E'\n\nIndependently verify the real current record, permission, consent, ownership, clinical context, urgency and approved Cureocity process before taking any action in those pages.'
    || E'\nThe Assistant has not inspected any record and cannot confirm that anything exists, is safe, is eligible, is urgent or is complete.';

  select coalesce(nullif(btrim(name), ''), 'Psychologist user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Psychologist profile could not be resolved'; end if;

  insert into staff_assistant_drafts (
    role_name, task_key, policy_version, task_version, action_tier,
    execution_mode, data_classifications, staff_instruction, context_snapshot,
    model_name, title, draft_text, evidence, caution, created_by, creator_name
  ) values (
    'Psychologist', 'workflow_checklist', p_policy_version, p_task_version, 1,
    'deterministic', array['Public application metadata', 'Internal operational'],
    p_workflow_key, v_context_snapshot, null, v_title, v_draft_text, v_evidence,
    v_caution, v_user_id, v_actor_name
  ) returning id into v_id;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft generated', 'Psychologist · workflow_checklist', 'Policy 2026-08-17.1; task psychologist.workflow_checklist.v1; deterministic static-route draft only; no record read or action executed');
  return v_id;
end;
$$;

create or replace function accept_psychologist_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Psychologist' then raise exception 'Psychologist checklist assistance requires the authenticated Psychologist role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Psychologist user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Psychologist profile could not be resolved'; end if;
  update staff_assistant_drafts set status = 'Accepted', accepted_text = draft_text,
    accepted_by = v_user_id, accepted_by_name = v_actor_name, accepted_at = now()
  where id = p_draft_id and role_name = 'Psychologist' and task_key = 'workflow_checklist'
    and created_by = v_user_id and status = 'Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;
  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft accepted', 'Psychologist · workflow_checklist', 'Immutable generated checklist stored as reviewed working text only; no record read or action executed');
  return true;
end;
$$;

create or replace function discard_psychologist_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Psychologist' then raise exception 'Psychologist checklist assistance requires the authenticated Psychologist role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Psychologist user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Psychologist profile could not be resolved'; end if;
  update staff_assistant_drafts set status = 'Discarded'
  where id = p_draft_id and role_name = 'Psychologist' and task_key = 'workflow_checklist'
    and created_by = v_user_id and status = 'Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;
  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft discarded', 'Psychologist · workflow_checklist', 'No record read or action executed');
  return true;
end;
$$;

revoke all on function create_psychologist_assistant_draft(text, text, text) from public, anon;
revoke all on function accept_psychologist_assistant_draft(uuid) from public, anon;
revoke all on function discard_psychologist_assistant_draft(uuid) from public, anon;
grant execute on function create_psychologist_assistant_draft(text, text, text) to authenticated;
grant execute on function accept_psychologist_assistant_draft(uuid) to authenticated;
grant execute on function discard_psychologist_assistant_draft(uuid) to authenticated;

commit;
