-- Cureocity Assistant — Finance deterministic process-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql. Forward-only and
-- default-off; apply in Development before setting
-- STAFF_COPILOT_FINANCE_ENABLED=true. No AI or application records used.

begin;

do $$ begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Finance Assistant pilot';
  end if;
end; $$;

create or replace function create_finance_assistant_draft(p_workflow_key text, p_policy_version text, p_task_version text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text; v_id uuid;
  v_title text; v_draft_text text; v_evidence jsonb; v_context_snapshot jsonb;
  v_caution text := 'Static navigation and finance-process orientation only. No invoice, payment, refund, credit, expense, payable, estimate, ledger, bank, cash, reimbursement, receipt, subscription, pass, POS, report, budget, price, payroll, salary, client, staff or message record was read; nothing was calculated, matched, categorized, raised, recorded, captured, changed, refunded, voided, credited, reversed, reimbursed, approved, paid, posted, reconciled or sent.';
begin
  if v_user_id is null or v_role <> 'Finance' then
    raise exception 'Finance checklist assistance requires the authenticated Finance role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('invoice_payment_reconciliation', 'refund_void_review_preparation', 'expense_reimbursement_evidence', 'reporting_and_control_review')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'finance.process_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs all persisted text from the allowlisted key.
  -- Callers cannot persist record data, arbitrary instructions, evidence, or
  -- edited output through this security-definer RPC.
  case p_workflow_key
    when 'invoice_payment_reconciliation' then
      v_title := 'Invoice and payment reconciliation checklist';
      v_context_snapshot := jsonb_build_object('role','Finance','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Billing','href','/billing?tab=invoices'),
        jsonb_build_object('label','Collections','href','/finsheets?tab=sales'),
        jsonb_build_object('label','Reports','href','/reports')),
        'checks',jsonb_build_array('Verify period, currency, invoice, payment source, status, dates, reference and basis.','Investigate differences in source systems.','The Assistant does not read, calculate, assert, record, post, reconcile or contact.'));
      v_evidence := jsonb_build_array('Billing, Collections and Reports are existing Finance-visible destinations.','Static reconciliation orientation only; no record or result is asserted.');
      v_draft_text := E'Review this static invoice and payment reconciliation checklist:\n\n1. Open Billing (/billing?tab=invoices).\n2. Open Collections (/finsheets?tab=sales).\n3. Open Reports (/reports).\n\nVerify period, currency, invoice identity, payment source, status, dates, reference and approved reconciliation basis. The Assistant does not read invoices or payments, calculate totals, assert a variance or match, record payment, post an entry, reconcile or contact anyone.';
    when 'refund_void_review_preparation' then
      v_title := 'Refund and void review preparation checklist';
      v_context_snapshot := jsonb_build_object('role','Finance','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Refunds and credits','href','/billing?tab=refunds'),
        jsonb_build_object('label','Paid invoices','href','/billing?status=paid'),
        jsonb_build_object('label','Collections','href','/finsheets?tab=sales')),
        'checks',jsonb_build_array('Verify invoice, settled status, source, amount, reason, authority, evidence and idempotency.','Use the atomic human-authorized workflow.','The Assistant does not determine eligibility, decide, refund, void, credit, reverse, approve or contact.'));
      v_evidence := jsonb_build_array('Refunds, paid invoices and Collections are existing Finance-visible destinations.','Static reversal controls only; no financial record is read.');
      v_draft_text := E'Review this static refund and void review preparation checklist:\n\n1. Open Refunds and credits (/billing?tab=refunds).\n2. Open Paid invoices (/billing?status=paid).\n3. Open Collections (/finsheets?tab=sales).\n\nVerify the invoice, settled status, payment source, amount, reason, authority, supporting evidence and duplicate-operation safeguards. The Assistant does not determine eligibility, recommend a decision, refund, void, credit, reverse a ledger entry, approve or contact anyone.';
    when 'expense_reimbursement_evidence' then
      v_title := 'Expense and reimbursement evidence checklist';
      v_context_snapshot := jsonb_build_object('role','Finance','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Expenses','href','/expenses'),
        jsonb_build_object('label','Reimbursements','href','/finsheets?tab=reimburse'),
        jsonb_build_object('label','Payables','href','/finsheets?tab=payable')),
        'checks',jsonb_build_array('Verify party, purpose, date, amount, currency, receipt, category, duplicate risk, authority and state.','Keep evidence separate from approval and payment.','The Assistant does not read, categorize, calculate, create, edit, approve, reject, reimburse, pay, post or change petty cash.'));
      v_evidence := jsonb_build_array('Expenses, Reimbursements and Payables are existing Finance-visible destinations.','Static evidence boundaries preserve approval and payment separation.');
      v_draft_text := E'Review this static expense and reimbursement evidence checklist:\n\n1. Open Expenses (/expenses).\n2. Open Reimbursements (/finsheets?tab=reimburse).\n3. Open Payables (/finsheets?tab=payable).\n\nVerify claimant or vendor, business purpose, date, amount, currency, receipt, category, duplicate risk, authority and payment state. The Assistant does not read a claim or receipt, categorize, calculate, create, edit, approve, reject, reimburse, pay, post or change petty cash.';
    when 'reporting_and_control_review' then
      v_title := 'Reporting and control review checklist';
      v_context_snapshot := jsonb_build_object('role','Finance','workflowKey',p_workflow_key,'destinations',jsonb_build_array(
        jsonb_build_object('label','Reports','href','/reports'),
        jsonb_build_object('label','Bank ledger','href','/finsheets?tab=bank'),
        jsonb_build_object('label','Subscriptions','href','/subscriptions')),
        'checks',jsonb_build_array('Verify period, currency, coverage, cut-off, filters, reconciliation state and reviewer.','Resolve exceptions against authoritative sources.','The Assistant does not read, calculate, forecast, infer a breach, change subscriptions, prices or budgets, post or issue a statement.'));
      v_evidence := jsonb_build_array('Reports, Bank ledger and Subscriptions are existing Finance-visible destinations.','Static control boundaries prohibit calculations and financial changes.');
      v_draft_text := E'Review this static reporting and control review checklist:\n\n1. Open Reports (/reports).\n2. Open Bank ledger (/finsheets?tab=bank).\n3. Open Subscriptions (/subscriptions).\n\nConfirm reporting period, currency, source coverage, cut-off, status filters, reconciliation state and responsible reviewer. The Assistant does not read reports or accounts, calculate a balance or forecast, infer a control breach, change a subscription, price or budget, post an entry or issue a statement.';
  end case;

  v_draft_text := v_draft_text || E'\n\nIndependently verify the real record, permission, period, currency, identity, source, status, dates, references, supporting evidence, authority, role separation and approved Cureocity finance workflow before taking any action.' || E'\nThe Assistant has not inspected any record and cannot confirm that anything exists, matches, is complete, is accurate, is eligible, is approved, is overdue, is reconciled or is paid.';
  select coalesce(nullif(btrim(name), ''), 'Finance user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Finance profile could not be resolved'; end if;

  insert into staff_assistant_drafts(role_name,task_key,policy_version,task_version,action_tier,execution_mode,data_classifications,staff_instruction,context_snapshot,model_name,title,draft_text,evidence,caution,created_by,creator_name)
  values('Finance','process_checklist',p_policy_version,p_task_version,1,'deterministic',array['Public application metadata','Internal operational'],p_workflow_key,v_context_snapshot,null,v_title,v_draft_text,v_evidence,v_caution,v_user_id,v_actor_name)
  returning id into v_id;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail)
  values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft generated','Finance · process_checklist','Policy 2026-08-17.1; task finance.process_checklist.v1; deterministic static-route draft only; no record read or financial action executed');
  return v_id;
end;
$$;

create or replace function accept_finance_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Finance' then raise exception 'Finance checklist assistance requires the authenticated Finance role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Finance user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'Finance profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Accepted',accepted_text=draft_text,accepted_by=v_user_id,accepted_by_name=v_actor_name,accepted_at=now()
  where id=p_draft_id and role_name='Finance' and task_key='process_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft accepted','Finance · process_checklist','Immutable generated checklist stored as reviewed working text only; no record read or financial action executed');
  return true;
end;
$$;

create or replace function discard_finance_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_role text := my_role(); v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Finance' then raise exception 'Finance checklist assistance requires the authenticated Finance role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Finance user') into v_actor_name from profiles where id=v_user_id;
  if v_actor_name is null then raise exception 'Finance profile could not be resolved'; end if;
  update staff_assistant_drafts set status='Discarded' where id=p_draft_id and role_name='Finance' and task_key='process_checklist' and created_by=v_user_id and status='Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;
  insert into audit_log(actor_id,actor_name,actor_role,action,target,detail) values(v_user_id,v_actor_name,v_role,'Cureocity Assistant draft discarded','Finance · process_checklist','No record read or financial action executed');
  return true;
end;
$$;

revoke all on function create_finance_assistant_draft(text,text,text) from public, anon;
revoke all on function accept_finance_assistant_draft(uuid) from public, anon;
revoke all on function discard_finance_assistant_draft(uuid) from public, anon;
grant execute on function create_finance_assistant_draft(text,text,text) to authenticated;
grant execute on function accept_finance_assistant_draft(uuid) to authenticated;
grant execute on function discard_finance_assistant_draft(uuid) to authenticated;

commit;
