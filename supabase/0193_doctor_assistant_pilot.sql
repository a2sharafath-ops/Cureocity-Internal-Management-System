-- Cureocity Assistant — Doctor deterministic workflow-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql. Forward-only and
-- default-off; apply in Development before setting
-- STAFF_COPILOT_DOCTOR_ENABLED=true. No AI or application records used.

begin;

do $$ begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Doctor Assistant pilot';
  end if;
end; $$;

create or replace function create_doctor_assistant_draft(p_workflow_key text, p_policy_version text, p_task_version text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text; v_id uuid;
  v_title text; v_draft_text text; v_evidence jsonb; v_context_snapshot jsonb;
  v_caution text := 'Static navigation and clinical-process orientation only. No client, medical, consultation, EMR, result, order, prescription, note, appointment, concern, safety, referral, finance, HR, staff or message record was read; nothing was diagnosed, interpreted, recommended, prescribed, ordered, changed, signed, approved, submitted, closed, assigned, delivered or sent.';
begin
  if v_user_id is null or v_role <> 'Doctor' then
    raise exception 'Doctor checklist assistance requires the authenticated Doctor role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('daily_clinical_orientation', 'consultation_and_emr_documentation', 'orders_and_results_review', 'safety_and_mdt_coordination')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'doctor.workflow_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs all persisted text from the allowlisted key.
  -- Callers cannot persist record data, arbitrary instructions, evidence, or
  -- edited output through this security-definer RPC.
  case p_workflow_key
    when 'daily_clinical_orientation' then
      v_title := 'Daily clinical orientation checklist';
      v_context_snapshot := jsonb_build_object('role','Doctor','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Today','href','/workspace?role=doctor&tab=dash'),
        jsonb_build_object('label','My clients','href','/workspace?role=doctor&tab=clients'),
        jsonb_build_object('label','Appointments','href','/workspace?role=doctor&tab=appts')),
        'checks',jsonb_build_array('Verify date, assignment, appointment state and ownership.','Use the existing consultation workflow.','The Assistant does not prioritize, book, change or claim completion.'));
      v_evidence := jsonb_build_array('Today, My clients and Appointments are existing Doctor-visible workspace destinations.','Static orientation only; no record state is asserted.');
      v_draft_text := E'Review this static daily clinical orientation checklist:\n\n1. Open Today (/workspace?role=doctor&tab=dash).\n2. Open My clients (/workspace?role=doctor&tab=clients).\n3. Open Appointments (/workspace?role=doctor&tab=appts).\n\nVerify the current date, assignment, appointment state, ownership and approved workflow. The Assistant does not prioritize a patient, book or change an appointment, or claim that work is due or complete.';
    when 'consultation_and_emr_documentation' then
      v_title := 'Consultation and EMR documentation checklist';
      v_context_snapshot := jsonb_build_object('role','Doctor','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','My clients','href','/workspace?role=doctor&tab=clients'),
        jsonb_build_object('label','Summaries','href','/workspace?role=doctor&tab=summaries'),
        jsonb_build_object('label','EMR','href','/emr')),
        'checks',jsonb_build_array('Confirm the correct permitted client and consultation.','Record only independently reviewed clinical content.','The Assistant does not read the EMR, diagnose, interpret results, recommend treatment, prescribe or create a note.'));
      v_evidence := jsonb_build_array('My clients, Summaries and EMR are existing Doctor-visible destinations.','Static documentation boundaries only; no EMR or consultation is read.');
      v_draft_text := E'Review this static consultation and EMR documentation checklist:\n\n1. Open My clients (/workspace?role=doctor&tab=clients).\n2. Open Summaries (/workspace?role=doctor&tab=summaries).\n3. Open EMR (/emr).\n\nConfirm the correct permitted client and consultation and record only independently reviewed content. The Assistant does not read the EMR, diagnose, interpret results, recommend treatment, prescribe or create a clinical note.';
    when 'orders_and_results_review' then
      v_title := 'Orders and results review checklist';
      v_context_snapshot := jsonb_build_object('role','Doctor','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Orders','href','/orders'),
        jsonb_build_object('label','EMR','href','/emr'),
        jsonb_build_object('label','Resource library','href','/workspace?role=doctor&tab=library')),
        'checks',jsonb_build_array('Confirm patient identity, status, source, date, units, reference information and clinical context.','Use the existing authorized workflow for clinical decisions.','The Assistant does not interpret results, select tests, place orders, prescribe, suggest a dose, sign, approve, publish or deliver.'));
      v_evidence := jsonb_build_array('Orders, EMR and Resource library are existing Doctor-visible destinations.','Static clinical boundaries prohibit interpretation, ordering and prescribing.');
      v_draft_text := E'Review this static orders and results review checklist:\n\n1. Open Orders (/orders).\n2. Open EMR (/emr).\n3. Open Resource library (/workspace?role=doctor&tab=library).\n\nConfirm identity, order status, source, date, units, reference information and clinical context. The Assistant does not read or interpret results, select tests, place orders, prescribe, suggest a dose, sign, approve, publish or deliver a document.';
    when 'safety_and_mdt_coordination' then
      v_title := 'Safety and MDT coordination checklist';
      v_context_snapshot := jsonb_build_object('role','Doctor','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Concerns','href','/workspace?role=doctor&tab=concerns'),
        jsonb_build_object('label','Whiteboard','href','/workspace?role=doctor&tab=whiteboard'),
        jsonb_build_object('label','MDT board','href','/workspace?role=doctor&tab=board')),
        'checks',jsonb_build_array('Use the approved human-led safety workflow.','Verify urgency, ownership, consent, minimum-necessary disclosure and required follow-up.','The Assistant does not assess risk, close, refer, assign, contact or replace emergency procedures.'));
      v_evidence := jsonb_build_array('Concerns, Whiteboard and MDT board are existing Doctor-visible workspace destinations.','Static safety boundaries explicitly prohibit risk assessment and closure.');
      v_draft_text := E'Review this static safety and MDT coordination checklist:\n\n1. Open Concerns (/workspace?role=doctor&tab=concerns).\n2. Open Whiteboard (/workspace?role=doctor&tab=whiteboard).\n3. Open MDT board (/workspace?role=doctor&tab=board).\n\nUse the approved human-led safety workflow and verify urgency, ownership, consent and minimum-necessary disclosure. The Assistant does not assess risk, close a safety item, create or send a referral, assign work, contact anyone or replace emergency procedures.';
  end case;

  v_draft_text := v_draft_text || E'\n\nIndependently verify the real current record, identity, permission, consent, ownership, source, clinical context, urgency and approved Cureocity workflow before taking any action.' || E'\nThe Assistant has not inspected any record and cannot confirm that anything exists, is safe, is indicated, is urgent or is complete.';
  select coalesce(nullif(btrim(name), ''), 'Doctor user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Doctor profile could not be resolved'; end if;

  insert into staff_assistant_drafts(role_name,task_key,policy_version,task_version,action_tier,execution_mode,data_classifications,staff_instruction,context_snapshot,model_name,title,draft_text,evidence,caution,created_by,creator_name)
  values('Doctor','workflow_checklist',p_policy_version,p_task_version,1,'deterministic',array['Public application metadata','Internal operational'],p_workflow_key,v_context_snapshot,null,v_title,v_draft_text,v_evidence,v_caution,v_user_id,v_actor_name)
  returning id into v_id;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail)
  values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft generated','Doctor · workflow_checklist','Policy 2026-08-17.1; task doctor.workflow_checklist.v1; deterministic static-route draft only; no record read or clinical action executed');
  return v_id;
end;
$$;

create or replace function accept_doctor_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Doctor' then raise exception 'Doctor checklist assistance requires the authenticated Doctor role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Doctor user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'Doctor profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Accepted',accepted_text=draft_text,accepted_by=v_user_id,accepted_by_name=v_actor_name,accepted_at=now()
  where id=p_draft_id and role_name='Doctor' and task_key='workflow_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft accepted','Doctor · workflow_checklist','Immutable generated checklist stored as reviewed working text only; no record read or clinical action executed');
  return true;
end;
$$;

create or replace function discard_doctor_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Doctor' then raise exception 'Doctor checklist assistance requires the authenticated Doctor role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Doctor user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'Doctor profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Discarded' where id=p_draft_id and role_name='Doctor' and task_key='workflow_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft discarded','Doctor · workflow_checklist','No record read or clinical action executed');
  return true;
end;
$$;

revoke all on function create_doctor_assistant_draft(text,text,text) from public, anon;
revoke all on function accept_doctor_assistant_draft(uuid) from public, anon;
revoke all on function discard_doctor_assistant_draft(uuid) from public, anon;
grant execute on function create_doctor_assistant_draft(text,text,text) to authenticated;
grant execute on function accept_doctor_assistant_draft(uuid) to authenticated;
grant execute on function discard_doctor_assistant_draft(uuid) to authenticated;

commit;
