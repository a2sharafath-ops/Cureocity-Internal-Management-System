-- ============================================================================
-- Cureocity Assistant — Dietitian deterministic review-checklist pilot.
-- Run after 0186_staff_assistant_policy_foundation.sql.
--
-- Forward-only and default-off. This migration adds exact Dietitian RPCs to the
-- shared draft/audit table. It does not enable a flag, call AI, read application
-- records, or change an existing pilot. Apply in Development before setting
-- STAFF_COPILOT_DIETITIAN_ENABLED=true.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.staff_assistant_drafts') is null then
    raise exception 'Migration 0186 must be applied before the Dietitian Assistant pilot';
  end if;
end;
$$;

create or replace function create_dietitian_assistant_draft(
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
  v_caution text := 'Static navigation and review-process orientation only. No client, clinical, consultation, assessment, chart, meal, recipe, monitoring, concern, finance, HR, staff or message record was read; nothing was calculated, recommended, prescribed, changed, submitted, approved, published, delivered or sent.';
begin
  if v_user_id is null or v_role <> 'Dietitian' then
    raise exception 'Dietitian checklist assistance requires the authenticated Dietitian role';
  end if;
  if p_workflow_key is null
     or p_workflow_key not in ('chart_review_readiness', 'nutrition_targets', 'meal_option_completeness', 'monitoring_and_handoff')
     or p_policy_version is distinct from '2026-08-17.1'
     or p_task_version is distinct from 'dietitian.review_checklist.v1' then
    raise exception 'Unapproved or stale Cureocity Assistant task contract';
  end if;

  -- The database constructs every persisted field from the allowlisted key.
  -- Callers cannot store client data, arbitrary instructions, evidence, or
  -- edited output through this security-definer RPC.
  case p_workflow_key
    when 'chart_review_readiness' then
      v_title := 'Chart review readiness checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Dietitian', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Diet charts', 'href', '/workspace?role=diet&tab=charts', 'purpose', 'Open the Dietitian Diet charts tab.'),
          jsonb_build_object('label', 'Summaries', 'href', '/workspace?role=diet&tab=summaries', 'purpose', 'Open the Dietitian Summaries tab.')
        ),
        'checks', jsonb_build_array(
          'Save and resolve every deterministic chart problem before submitting for review.',
          'Preview the PDF and independently verify the saved chart before submission.',
          'A Dietitian submits for Medical Director review; the Assistant never approves, publishes or delivers a chart.'
        )
      );
      v_evidence := jsonb_build_array(
        'Diet charts and Summaries are existing Dietitian-visible workspace destinations.',
        'Existing deterministic review rules require problem resolution and independent PDF review.'
      );
      v_draft_text := E'Review this static chart review readiness checklist:\n\nNavigation\n1. Open Diet charts (/workspace?role=diet&tab=charts).\n2. Open Summaries (/workspace?role=diet&tab=summaries).\n\nDeterministic checks\n1. Save and resolve every deterministic chart problem before submitting for review.\n2. Preview the PDF and independently verify the saved chart before submission.\n3. A Dietitian submits for Medical Director review; the Assistant never approves, publishes or delivers a chart.';
    when 'nutrition_targets' then
      v_title := 'Nutrition targets checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Dietitian', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Diet charts', 'href', '/workspace?role=diet&tab=charts', 'purpose', 'Open the Dietitian Diet charts tab.'),
          jsonb_build_object('label', 'Dish library', 'href', '/workspace?role=diet&tab=dishes', 'purpose', 'Open the costed Dish library used by chart options.')
        ),
        'checks', jsonb_build_array(
          'Set a daily calorie target.',
          'Set positive minimum and maximum daily ranges for carbohydrate, protein, fat and fibre; each minimum must not exceed its maximum.',
          'Set a daily water-intake target.',
          'Use calculated daily ranges as evidence; the Assistant does not invent or settle clinical targets.'
        )
      );
      v_evidence := jsonb_build_array(
        'Diet charts and Dish library are existing Dietitian-visible workspace destinations.',
        'Existing deterministic review rules require calorie, macro, fibre and water targets.'
      );
      v_draft_text := E'Review this static nutrition targets checklist:\n\nNavigation\n1. Open Diet charts (/workspace?role=diet&tab=charts).\n2. Open Dish library (/workspace?role=diet&tab=dishes).\n\nDeterministic checks\n1. Set a daily calorie target.\n2. Set positive minimum and maximum daily ranges for carbohydrate, protein, fat and fibre; each minimum must not exceed its maximum.\n3. Set a daily water-intake target.\n4. Use calculated daily ranges as evidence; the Assistant does not invent or settle clinical targets.';
    when 'meal_option_completeness' then
      v_title := 'Meal-option completeness checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Dietitian', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Diet charts', 'href', '/workspace?role=diet&tab=charts', 'purpose', 'Open the Dietitian Diet charts tab.'),
          jsonb_build_object('label', 'Recipes', 'href', '/workspace?role=diet&tab=recipes', 'purpose', 'Open the existing recipe workspace tab.'),
          jsonb_build_object('label', 'Dish library', 'href', '/workspace?role=diet&tab=dishes', 'purpose', 'Open the costed Dish library used by chart options.')
        ),
        'checks', jsonb_build_array(
          'Every active meal slot must contain exactly four reviewed options.',
          'Each named option needs quantity plus complete calories, carbohydrate, protein, fat and fibre values.',
          'Each named option needs a reviewed micronutrient line.',
          'Recipe-backed calculations must use approved current dishes; free-text values remain the Dietitian''s responsibility.'
        )
      );
      v_evidence := jsonb_build_array(
        'Diet charts, Recipes and Dish library are existing Dietitian-visible workspace destinations.',
        'Existing deterministic review rules require four options, quantities, macros and micronutrients.'
      );
      v_draft_text := E'Review this static meal-option completeness checklist:\n\nNavigation\n1. Open Diet charts (/workspace?role=diet&tab=charts).\n2. Open Recipes (/workspace?role=diet&tab=recipes).\n3. Open Dish library (/workspace?role=diet&tab=dishes).\n\nDeterministic checks\n1. Every active meal slot must contain exactly four reviewed options.\n2. Each named option needs quantity plus complete calories, carbohydrate, protein, fat and fibre values.\n3. Each named option needs a reviewed micronutrient line.\n4. Recipe-backed calculations must use approved current dishes.';
    when 'monitoring_and_handoff' then
      v_title := 'Monitoring and handoff checklist';
      v_context_snapshot := jsonb_build_object(
        'role', 'Dietitian', 'workflowKey', p_workflow_key,
        'destinations', jsonb_build_array(
          jsonb_build_object('label', 'Meal monitoring', 'href', '/workspace?role=diet&tab=meals', 'purpose', 'Open the Dietitian Meal monitoring tab.'),
          jsonb_build_object('label', 'Concerns', 'href', '/workspace?role=diet&tab=concerns', 'purpose', 'Open the Dietitian Concerns tab.'),
          jsonb_build_object('label', 'MDT board', 'href', '/workspace?role=diet&tab=board', 'purpose', 'Open the Dietitian MDT board tab.')
        ),
        'checks', jsonb_build_array(
          'Independently verify ownership, current status and safety state in each destination.',
          'Use the approved handoff or escalation workflow when a concern requires another discipline.',
          'The Assistant does not summarize monitoring data, create a handoff, close a concern or contact anyone.'
        )
      );
      v_evidence := jsonb_build_array(
        'Meal monitoring, Concerns and MDT board are existing Dietitian-visible workspace destinations.',
        'The checklist directs the Dietitian to verify real state and use the approved handoff process.'
      );
      v_draft_text := E'Review this static monitoring and handoff checklist:\n\nNavigation\n1. Open Meal monitoring (/workspace?role=diet&tab=meals).\n2. Open Concerns (/workspace?role=diet&tab=concerns).\n3. Open MDT board (/workspace?role=diet&tab=board).\n\nDeterministic checks\n1. Independently verify ownership, current status and safety state.\n2. Use the approved handoff or escalation workflow when required.\n3. The Assistant does not summarize data, create a handoff, close a concern or contact anyone.';
  end case;

  v_draft_text := v_draft_text
    || E'\n\nIndependently verify the saved chart or record, current state, ownership, clinical suitability and approved Cureocity workflow before doing anything in those pages.'
    || E'\nThe Assistant has not inspected any record and cannot confirm that an item exists, is current, safe, eligible or complete.';

  select coalesce(nullif(btrim(name), ''), 'Dietitian user') into v_actor_name
  from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Dietitian profile could not be resolved'; end if;

  insert into staff_assistant_drafts (
    role_name, task_key, policy_version, task_version, action_tier,
    execution_mode, data_classifications, staff_instruction, context_snapshot,
    model_name, title, draft_text, evidence, caution, created_by, creator_name
  ) values (
    'Dietitian', 'review_checklist', p_policy_version, p_task_version, 1,
    'deterministic', array['Public application metadata', 'Internal operational'],
    p_workflow_key, v_context_snapshot, null, v_title, v_draft_text, v_evidence,
    v_caution, v_user_id, v_actor_name
  ) returning id into v_id;

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft generated', 'Dietitian · review_checklist', 'Policy 2026-08-17.1; task dietitian.review_checklist.v1; deterministic static-rule draft only; no record read or action executed');
  return v_id;
end;
$$;

create or replace function accept_dietitian_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := my_role();
  v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Dietitian' then raise exception 'Dietitian checklist assistance requires the authenticated Dietitian role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Dietitian user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Dietitian profile could not be resolved'; end if;
  update staff_assistant_drafts set
    status = 'Accepted', accepted_text = draft_text, accepted_by = v_user_id,
    accepted_by_name = v_actor_name, accepted_at = now()
  where id = p_draft_id and role_name = 'Dietitian' and task_key = 'review_checklist'
    and created_by = v_user_id and status = 'Draft';
  if not found then raise exception 'Draft is not available for acceptance'; end if;
  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft accepted', 'Dietitian · review_checklist', 'Immutable generated checklist stored as reviewed working text only; no record read or action executed');
  return true;
end;
$$;

create or replace function discard_dietitian_assistant_draft(p_draft_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := my_role();
  v_actor_name text;
begin
  if v_user_id is null or v_role <> 'Dietitian' then raise exception 'Dietitian checklist assistance requires the authenticated Dietitian role'; end if;
  select coalesce(nullif(btrim(name), ''), 'Dietitian user') into v_actor_name from profiles where id = v_user_id;
  if v_actor_name is null then raise exception 'Dietitian profile could not be resolved'; end if;
  update staff_assistant_drafts set status = 'Discarded'
  where id = p_draft_id and role_name = 'Dietitian' and task_key = 'review_checklist'
    and created_by = v_user_id and status = 'Draft';
  if not found then raise exception 'Draft is not available for discard'; end if;
  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail)
  values (v_user_id, v_actor_name, v_role, 'Cureocity Assistant draft discarded', 'Dietitian · review_checklist', 'No record read or action executed');
  return true;
end;
$$;

revoke all on function create_dietitian_assistant_draft(text, text, text) from public, anon;
revoke all on function accept_dietitian_assistant_draft(uuid) from public, anon;
revoke all on function discard_dietitian_assistant_draft(uuid) from public, anon;
grant execute on function create_dietitian_assistant_draft(text, text, text) to authenticated;
grant execute on function accept_dietitian_assistant_draft(uuid) to authenticated;
grant execute on function discard_dietitian_assistant_draft(uuid) to authenticated;

commit;
