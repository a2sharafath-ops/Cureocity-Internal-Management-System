-- Cureocity Assistant — Medical Director deterministic review-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql. Forward-only and
-- default-off; apply in Development before setting
-- STAFF_COPILOT_MEDICAL_DIRECTOR_ENABLED=true. No AI or application records used.

begin;

do $$ begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Medical Director Assistant pilot';
  end if;
end; $$;

create or replace function create_medical_director_assistant_draft(p_workflow_key text, p_policy_version text, p_task_version text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text; v_id uuid;
  v_title text; v_draft_text text; v_evidence jsonb; v_context_snapshot jsonb;
  v_caution text := 'Static navigation, review and governance orientation only. No approval queue, client, medical, clinical, consultation, EMR, result, order, prescription, diet plan, diet assessment, therapy-note, appointment, concern, safety, referral, finance, HR, staff or message record was read; nothing was diagnosed, interpreted, recommended, prescribed, assessed, ranked, changed, approved, rejected, signed, published, delivered, closed, assigned or sent.';
begin
  if v_user_id is null or v_role <> 'Medical Director' then
    raise exception 'Medical Director checklist assistance requires the authenticated Medical Director role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('review_queue_orientation', 'evidence_completeness_review', 'safety_escalation_governance', 'cross_discipline_governance')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'medical_director.review_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs all persisted text from the allowlisted key.
  -- Callers cannot persist record data, arbitrary instructions, evidence, or
  -- edited output through this security-definer RPC.
  case p_workflow_key
    when 'review_queue_orientation' then
      v_title := 'Review queue orientation checklist';
      v_context_snapshot := jsonb_build_object('role','Medical Director','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Approvals','href','/workspace?role=doctor&tab=approvals'),
        jsonb_build_object('label','Doctor workspace','href','/workspace?role=doctor&tab=dash'),
        jsonb_build_object('label','Dietitian workspace','href','/workspace?role=diet&tab=dash')),
        'checks',jsonb_build_array('Verify the real queue, document, version, author, client, submission state and waiting time.','Review the actual source document before deciding.','The Assistant does not read, rank, inspect, approve, reject, request changes, publish or deliver.'));
      v_evidence := jsonb_build_array('Approvals and discipline workspaces are existing Medical Director-visible destinations.','Static review orientation only; no queue or document state is asserted.');
      v_draft_text := E'Review this static review queue orientation checklist:\n\n1. Open Approvals (/workspace?role=doctor&tab=approvals).\n2. Open Doctor workspace (/workspace?role=doctor&tab=dash).\n3. Open Dietitian workspace (/workspace?role=diet&tab=dash).\n\nVerify the real queue, document type, version, author, client identity, submission state and time waiting. The Assistant does not read or rank the queue, inspect a document, approve, reject, request changes, publish or deliver anything.';
    when 'evidence_completeness_review' then
      v_title := 'Evidence completeness review checklist';
      v_context_snapshot := jsonb_build_object('role','Medical Director','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Approvals','href','/workspace?role=doctor&tab=approvals'),
        jsonb_build_object('label','EMR','href','/emr'),
        jsonb_build_object('label','Orders','href','/orders')),
        'checks',jsonb_build_array('Verify identity, scope, source, date, units, version, authorship, sign-offs and workflow.','Separate missing from conflicting evidence.','The Assistant does not inspect evidence, decide completeness, interpret, diagnose, recommend, prescribe, sign or approve.'));
      v_evidence := jsonb_build_array('Approvals, EMR and Orders are existing Medical Director-visible destinations.','Static completeness boundaries only; no evidence is read.');
      v_draft_text := E'Review this static evidence completeness review checklist:\n\n1. Open Approvals (/workspace?role=doctor&tab=approvals).\n2. Open EMR (/emr).\n3. Open Orders (/orders).\n\nVerify identity, scope, source, date, units, version, authorship, required sign-offs and the governing workflow. The Assistant does not inspect evidence, decide completeness, interpret a result, diagnose, recommend treatment, prescribe, sign or approve.';
    when 'safety_escalation_governance' then
      v_title := 'Safety escalation governance checklist';
      v_context_snapshot := jsonb_build_object('role','Medical Director','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Concerns','href','/workspace?role=doctor&tab=concerns'),
        jsonb_build_object('label','Whiteboard','href','/workspace?role=doctor&tab=whiteboard'),
        jsonb_build_object('label','MDT board','href','/workspace?role=doctor&tab=board')),
        'checks',jsonb_build_array('Use the approved human-led safety and emergency workflow.','Verify urgency, ownership, consent, disclosure, destination and follow-up.','The Assistant does not read, classify, assess risk, advise, close, refer, assign or contact.'));
      v_evidence := jsonb_build_array('Concerns, Whiteboard and MDT board are existing Medical Director-visible destinations.','Static safety boundaries prohibit classification, risk assessment and closure.');
      v_draft_text := E'Review this static safety escalation governance checklist:\n\n1. Open Concerns (/workspace?role=doctor&tab=concerns).\n2. Open Whiteboard (/workspace?role=doctor&tab=whiteboard).\n3. Open MDT board (/workspace?role=doctor&tab=board).\n\nUse the approved human-led safety workflow and verify urgency, ownership, consent, minimum-necessary disclosure, escalation destination and follow-up. The Assistant does not read or classify a concern, assess risk, provide crisis advice, close an event, refer, assign or contact anyone.';
    when 'cross_discipline_governance' then
      v_title := 'Cross-discipline governance checklist';
      v_context_snapshot := jsonb_build_object('role','Medical Director','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Doctor workspace','href','/workspace?role=doctor&tab=dash'),
        jsonb_build_object('label','Dietitian workspace','href','/workspace?role=diet&tab=dash'),
        jsonb_build_object('label','Health Coach quality oversight','href','/workspace?role=coach&tab=quality')),
        'checks',jsonb_build_array('Confirm purpose, ownership, permitted scope and approved standard.','Separate observations from clinical decisions.','The Assistant does not compare, score, infer a breach, override, change a standard, assign or decide.'));
      v_evidence := jsonb_build_array('Doctor, Dietitian and Health Coach quality-oversight destinations are Medical Director-visible.','Static governance boundaries prohibit scoring and decisions.');
      v_draft_text := E'Review this static cross-discipline governance checklist:\n\n1. Open Doctor workspace (/workspace?role=doctor&tab=dash).\n2. Open Dietitian workspace (/workspace?role=diet&tab=dash).\n3. Open Health Coach quality oversight (/workspace?role=coach&tab=quality).\n\nConfirm the oversight purpose, professional ownership, permitted scope and approved standard. The Assistant does not compare staff or clients, score performance, infer a breach, override a clinician, change a standard, assign work or make a governance decision.';
  end case;

  v_draft_text := v_draft_text || E'\n\nIndependently verify the real record, identity, permission, consent, ownership, source, evidence, clinical context, urgency, required sign-offs and approved Cureocity workflow before taking any action.' || E'\nThe Assistant has not inspected any record and cannot confirm that anything exists, is complete, is safe, is indicated, is urgent, is compliant or is resolved.';
  select coalesce(nullif(btrim(name), ''), 'Medical Director user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Medical Director profile could not be resolved'; end if;

  insert into staff_assistant_drafts(role_name,task_key,policy_version,task_version,action_tier,execution_mode,data_classifications,staff_instruction,context_snapshot,model_name,title,draft_text,evidence,caution,created_by,creator_name)
  values('Medical Director','review_checklist',p_policy_version,p_task_version,1,'deterministic',array['Public application metadata','Internal operational'],p_workflow_key,v_context_snapshot,null,v_title,v_draft_text,v_evidence,v_caution,v_user_id,v_actor_name)
  returning id into v_id;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail)
  values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft generated','Medical Director · review_checklist','Policy 2026-08-17.1; task medical_director.review_checklist.v1; deterministic static-route draft only; no record read or clinical/governance action executed');
  return v_id;
end;
$$;

create or replace function accept_medical_director_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Medical Director' then raise exception 'Medical Director checklist assistance requires the authenticated Medical Director role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Medical Director user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'Medical Director profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Accepted',accepted_text=draft_text,accepted_by=v_user_id,accepted_by_name=v_actor_name,accepted_at=now()
  where id=p_draft_id and role_name='Medical Director' and task_key='review_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft accepted','Medical Director · review_checklist','Immutable generated checklist stored as reviewed working text only; no record read or clinical/governance action executed');
  return true;
end;
$$;

create or replace function discard_medical_director_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Medical Director' then raise exception 'Medical Director checklist assistance requires the authenticated Medical Director role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Medical Director user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'Medical Director profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Discarded' where id=p_draft_id and role_name='Medical Director' and task_key='review_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft discarded','Medical Director · review_checklist','No record read or clinical/governance action executed');
  return true;
end;
$$;

revoke all on function create_medical_director_assistant_draft(text,text,text) from public, anon;
revoke all on function accept_medical_director_assistant_draft(uuid) from public, anon;
revoke all on function discard_medical_director_assistant_draft(uuid) from public, anon;
grant execute on function create_medical_director_assistant_draft(text,text,text) to authenticated;
grant execute on function accept_medical_director_assistant_draft(uuid) to authenticated;
grant execute on function discard_medical_director_assistant_draft(uuid) to authenticated;

commit;
