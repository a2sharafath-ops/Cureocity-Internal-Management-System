-- Cureocity Assistant — HR deterministic process-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql. Forward-only and
-- default-off; apply in Development before setting STAFF_COPILOT_HR_ENABLED=true.
-- No AI call and no HR/application record read is permitted by this pilot.

begin;

do $$ begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the HR Assistant pilot';
  end if;
end; $$;

create or replace function create_hr_assistant_draft(p_workflow_key text, p_policy_version text, p_task_version text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text; v_id uuid;
  v_title text; v_draft_text text; v_evidence jsonb; v_context_snapshot jsonb;
  v_caution text := 'Static navigation and HR-process orientation only. No staff, attendance, leave, roster, payroll, salary, recruitment, onboarding, offboarding, training, performance, complaint, health, government-ID, document, access or message record was read; nobody was scored, ranked, assessed, hired, terminated, disciplined, compensated, assigned, approved, rejected, changed, provisioned, removed or contacted.';
begin
  if v_user_id is null or v_role <> 'HR' then
    raise exception 'HR checklist assistance requires the authenticated HR role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('onboarding_offboarding_process', 'attendance_leave_process', 'training_policy_guidance', 'capacity_privacy_review')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'hr.process_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs all persisted text from the allowlisted key.
  -- Callers cannot persist person/record data, arbitrary instructions,
  -- evidence, edited output, or a decision through this security-definer RPC.
  case p_workflow_key
    when 'onboarding_offboarding_process' then
      v_title := 'Onboarding and offboarding process checklist';
      v_context_snapshot := jsonb_build_object('role','HR','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','On / offboarding','href','/hr?tab=boarding'),
        jsonb_build_object('label','Employees','href','/hr?tab=employees'),
        jsonb_build_object('label','Knowledge base','href','/kb')),
        'checks',jsonb_build_array('Verify authorized person, process, date, owner, notice or consent, source documents and role separation.','Use current approved policy.','The Assistant does not read, create, complete, provision, remove, change, upload or contact.'));
      v_evidence := jsonb_build_array('On / offboarding, Employees and Knowledge base are existing HR-visible destinations.','Static process orientation only; no person or document is read.');
      v_draft_text := E'Review this static onboarding and offboarding process checklist:\n\n1. Open On / offboarding (/hr?tab=boarding).\n2. Open Employees (/hr?tab=employees).\n3. Open Knowledge base (/kb).\n\nVerify the authorized person, process type, effective date, checklist owner, required notice or consent, source documents and role separation. The Assistant does not read a person or document, create or complete a checklist, provision or remove access, change employment state, upload a document or contact anyone.';
    when 'attendance_leave_process' then
      v_title := 'Attendance and leave process checklist';
      v_context_snapshot := jsonb_build_object('role','HR','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Staff & Attendance','href','/hr?tab=attendance'),
        jsonb_build_object('label','Leave','href','/hr?tab=leave'),
        jsonb_build_object('label','Roster','href','/hr?tab=roster')),
        'checks',jsonb_build_array('Verify identity, date, source, status, policy, entitlement basis and approver.','Keep review, calculation, approval, roster and payroll roles separate.','The Assistant does not read, mark, calculate, approve, reject, change or contact.'));
      v_evidence := jsonb_build_array('Staff & Attendance, Leave and Roster are existing HR-visible destinations.','Static controls preserve authorized human decisions.');
      v_draft_text := E'Review this static attendance and leave process checklist:\n\n1. Open Staff & Attendance (/hr?tab=attendance).\n2. Open Leave (/hr?tab=leave).\n3. Open Roster (/hr?tab=roster).\n\nVerify staff identity, date and time, source evidence, status, applicable policy, entitlement basis and required approver. The Assistant does not read attendance or leave records, mark attendance, calculate entitlement, approve or reject leave, change a roster, change payroll or contact anyone.';
    when 'training_policy_guidance' then
      v_title := 'Training and policy guidance checklist';
      v_context_snapshot := jsonb_build_object('role','HR','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Knowledge base','href','/kb'),
        jsonb_build_object('label','Employees','href','/hr?tab=employees'),
        jsonb_build_object('label','On / offboarding','href','/hr?tab=boarding')),
        'checks',jsonb_build_array('Verify owner, approved version, effective date, audience, acknowledgement and training owner.','Use only published policy.','The Assistant does not read, assess, assign, acknowledge, publish or contact.'));
      v_evidence := jsonb_build_array('Knowledge base, Employees and On / offboarding are existing HR-visible destinations.','Static policy orientation only; no personnel or training record is read.');
      v_draft_text := E'Review this static training and policy guidance checklist:\n\n1. Open Knowledge base (/kb).\n2. Open Employees (/hr?tab=employees).\n3. Open On / offboarding (/hr?tab=boarding).\n\nVerify the policy or SOP owner, approved version, effective date, intended audience, required acknowledgement and training owner. The Assistant does not read personnel or training records, assess competence or compliance, assign training, acknowledge policy, publish documents or contact anyone.';
    when 'capacity_privacy_review' then
      v_title := 'Capacity and privacy review checklist';
      v_context_snapshot := jsonb_build_object('role','HR','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Roster','href','/hr?tab=roster'),
        jsonb_build_object('label','Staff & Attendance','href','/hr?tab=attendance'),
        jsonb_build_object('label','Holidays','href','/hr?tab=holidays')),
        'checks',jsonb_build_array('Treat counts and schedules as incomplete signals.','Do not rank people, infer protected traits or use capacity alone for employment decisions.','The Assistant does not read, score, rank, assign, decide, approve, hire, terminate, change access or contact.'));
      v_evidence := jsonb_build_array('Roster, Staff & Attendance and Holidays are existing HR-visible destinations.','Static privacy boundaries prohibit employee scoring and employment decisions.');
      v_draft_text := E'Review this static capacity and privacy review checklist:\n\n1. Open Roster (/hr?tab=roster).\n2. Open Staff & Attendance (/hr?tab=attendance).\n3. Open Holidays (/hr?tab=holidays).\n\nTreat counts and schedules as incomplete operational signals. Do not rank individuals, infer health or protected traits, or use capacity information as the sole basis for an employment or performance decision. The Assistant does not read staff, attendance, roster or leave records, score or rank people, assign work, decide performance or discipline, approve leave, hire, terminate, change access or contact anyone.';
  end case;

  v_draft_text := v_draft_text || E'\n\nIndependently verify the real person, permission, policy, effective date, evidence, consent or notice, owner, reviewer, privacy boundary and approved Cureocity HR workflow before taking any action.' || E'\nThe Assistant has not inspected any HR or application record and cannot confirm that anything exists, is current, complete, accurate, eligible, approved, compliant, safe or resolved.';
  select coalesce(nullif(btrim(name), ''), 'HR user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'HR profile could not be resolved'; end if;

  insert into staff_assistant_drafts(role_name,task_key,policy_version,task_version,action_tier,execution_mode,data_classifications,staff_instruction,context_snapshot,model_name,title,draft_text,evidence,caution,created_by,creator_name)
  values('HR','process_checklist',p_policy_version,p_task_version,1,'deterministic',array['Public application metadata','Internal operational'],p_workflow_key,v_context_snapshot,null,v_title,v_draft_text,v_evidence,v_caution,v_user_id,v_actor_name)
  returning id into v_id;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail)
  values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft generated','HR · process_checklist','Policy 2026-08-17.1; task hr.process_checklist.v1; deterministic static-route draft only; no record read or HR action executed');
  return v_id;
end;
$$;

create or replace function accept_hr_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'HR' then raise exception 'HR checklist assistance requires the authenticated HR role'; end if;
  select coalesce(nullif(btrim(name), ''), 'HR user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'HR profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Accepted',accepted_text=draft_text,accepted_by=v_user_id,accepted_by_name=v_actor_name,accepted_at=now()
  where id=p_draft_id and role_name='HR' and task_key='process_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft accepted','HR · process_checklist','Immutable generated checklist stored as reviewed working text only; no record read or HR action executed');
  return true;
end;
$$;

create or replace function discard_hr_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'HR' then raise exception 'HR checklist assistance requires the authenticated HR role'; end if;
  select coalesce(nullif(btrim(name), ''), 'HR user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'HR profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Discarded' where id=p_draft_id and role_name='HR' and task_key='process_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft discarded','HR · process_checklist','No record read or HR action executed');
  return true;
end;
$$;

revoke all on function create_hr_assistant_draft(text,text,text) from public, anon;
revoke all on function accept_hr_assistant_draft(uuid) from public, anon;
revoke all on function discard_hr_assistant_draft(uuid) from public, anon;
grant execute on function create_hr_assistant_draft(text,text,text) to authenticated;
grant execute on function accept_hr_assistant_draft(uuid) to authenticated;
grant execute on function discard_hr_assistant_draft(uuid) to authenticated;

commit;
