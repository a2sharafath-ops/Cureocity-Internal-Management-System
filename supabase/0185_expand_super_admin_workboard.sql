-- ============================================================================
-- Cureocity — expand the Super Admin Workboard backlog.
-- Run after 0184.
--
-- Forward-only and idempotent. Reconciles migration-managed descriptions,
-- records the already-decided no-UAT release path, and adds the known
-- Development, Production cutover, security/operations, and roadmap work.
-- It does not perform any of the described work or change a user-managed
-- status except the settled no-UAT decision.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.workboard_items') is null
     or to_regclass('public.workboard_item_history') is null then
    raise exception 'Migration 0184 must be applied before 0185';
  end if;
end;
$$;

-- Workboard content is migration-managed. Disable its status trigger only for
-- this transaction while descriptions/order are reconciled; the ALTER is
-- transactional, so a failure restores the prior trigger state.
alter table workboard_items disable trigger workboard_status_guard;

update workboard_items as item
set workstream = source.workstream,
    title = source.title,
    state_note = source.state_note,
    next_action = source.next_action,
    sort_order = source.sort_order
from (values
  ('app-feedback-navigation', 'Product roadmap', 'App Feedback navigation',
   'Available to authenticated staff in the sidebar; administrator triage remains separate.',
   'Monitor staff usage and triage submitted app feedback.', 10),
  ('staff-copilot-framework', 'Product roadmap', 'Staff copilot framework',
   'Role-aware staff framework and safeguards are built.',
   'Keep unapproved roles inert until their allowed tasks and boundaries are defined.', 20),
  ('super-admin-preview-navigation', 'Product roadmap', 'Super Admin preview navigation clarification',
   'The role-preview state can make clinical workspace navigation look native to Super Admin.',
   'Clarify preview labels and keep native Super Admin navigation distinct from clinician preview.', 30),
  ('meeting-to-sprint-assistant', 'Product roadmap', 'Meeting-to-Sprint AI Assistant',
   'Review-first scope only; capture, transcription, AI calls, integrations, assignments, and financial actions are not implemented.',
   'Resolve consent, retention, provider, approved-data, and approval-workflow decisions in docs/meeting-to-sprint-ai-assistant-scope.md.', 40),

  ('development-environment', 'Development configuration', 'Development environment',
   'The isolated AWS Development stack is ready for synthetic local testing.',
   'Keep it synthetic-only and verify each later migration before exercising dependent code.', 110),
  ('super-admin-copilot', 'Development configuration', 'Development Super Admin Copilot configuration',
   'The review-only pilot is built; Development OpenAI configuration, feature enablement, and a successful synthetic smoke test remain outstanding.',
   'Securely add a Development-only OPENAI_API_KEY, enable STAFF_COPILOT_SUPER_ADMIN_ENABLED only in Development, restart, and run the approved synthetic Super Admin smoke test.', 120),
  ('development-staff-accounts', 'Development configuration', 'Development staff test accounts',
   'Only the approved synthetic Development accounts currently exist; the full staff-role set is not available for testing.',
   'Create only the additional synthetic role accounts required for Development role and navigation tests.', 130),
  ('aws-setup-review', 'Development configuration', 'AWS setup docs/scripts and migration 0182 review',
   'Development setup documentation, tunnel/setup scripts, and privileged-RPC migration 0182 remain separate from completed product work.',
   'Review their security and recovery behavior, verify 0182 in Development, and commit them separately if approved.', 140),

  ('production-deployment', 'Production readiness', 'Current Vercel Production deployment',
   'The current hosted main deployment is healthy; this does not mean the later AWS Production migration is complete.',
   'Keep the hosted Production service stable until every AWS cutover gate and rollback check passes.', 210),
  ('production-staff-smoke-tests', 'Production readiness', 'Production staff role smoke tests',
   'Public availability and anonymous auth gating pass, but authenticated landing, navigation, and core reads are not verified for the live staff-role set.',
   'Run a controlled read-only smoke test with one approved real Production account per required role and record the evidence.', 220),

  ('hosted-uat-decision', 'AWS Production migration', 'No-UAT Production release path decision',
   'Decision confirmed: no hosted UAT environment will be introduced; isolated AWS Development is the test stage before a controlled Production gate.',
   'Use explicit Development evidence, Production go/no-go approval, backups, and rollback gates because there is no UAT promotion stage.', 310),
  ('duplicate-deploy-triggers', 'Security & operations', 'Duplicate Vercel deployment trigger review',
   'A main push can create builds through both native Vercel Git integration and the GitHub deploy hook.',
   'Choose and document one hosted deployment trigger while Vercel remains active; remove redundancy only after release control is confirmed.', 440)
) as source(item_key, workstream, title, state_note, next_action, sort_order)
where item.item_key = source.item_key
  and (item.workstream, item.title, item.state_note, item.next_action, item.sort_order)
      is distinct from
      (source.workstream, source.title, source.state_note, source.next_action, source.sort_order);

-- The absence of hosted UAT is now a decided release constraint, not an open
-- choice. If the old row was still open, record this one authoritative status
-- transition explicitly; never rewrite any other user-managed status.
do $$
declare
  decision_id uuid;
  previous_status text;
  decision_title text;
  decision_changed_at timestamptz := now();
begin
  select id, status, title
    into decision_id, previous_status, decision_title
  from workboard_items
  where item_key = 'hosted-uat-decision';

  if decision_id is not null and previous_status is distinct from 'Done' then
    update workboard_items
    set status = 'Done',
        updated_at = decision_changed_at,
        updated_by = null,
        updated_by_name = 'Migration 0185',
        version = version + 1
    where id = decision_id;

    insert into workboard_item_history (
      item_id, from_status, to_status, changed_by, changed_by_name, changed_at
    ) values (
      decision_id, previous_status, 'Done', null, 'Migration 0185', decision_changed_at
    );

    insert into audit_log (actor_id, actor_name, actor_role, action, target, detail, created_at)
    values (
      null, 'Migration 0185', 'System migration', 'Workboard status changed',
      decision_title, previous_status || ' -> Done; no hosted UAT path confirmed', decision_changed_at
    );
  end if;
end;
$$;

-- Insert the complete baseline. Conflict handling preserves later Super Admin
-- status choices and makes a re-run harmless.
insert into workboard_items (
  item_key, workstream, title, state_note, status, next_action, sort_order
) values
  ('app-feedback-navigation', 'Product roadmap', 'App Feedback navigation',
   'Available to authenticated staff in the sidebar; administrator triage remains separate.', 'Done',
   'Monitor staff usage and triage submitted app feedback.', 10),
  ('staff-copilot-framework', 'Product roadmap', 'Staff copilot framework',
   'Role-aware staff framework and safeguards are built.', 'Done',
   'Keep unapproved roles inert until their allowed tasks and boundaries are defined.', 20),
  ('super-admin-preview-navigation', 'Product roadmap', 'Super Admin preview navigation clarification',
   'The role-preview state can make clinical workspace navigation look native to Super Admin.', 'Pending',
   'Clarify preview labels and keep native Super Admin navigation distinct from clinician preview.', 30),
  ('meeting-to-sprint-assistant', 'Product roadmap', 'Meeting-to-Sprint AI Assistant',
   'Review-first scope only; capture, transcription, AI calls, integrations, assignments, and financial actions are not implemented.', 'Pending',
   'Resolve consent, retention, provider, approved-data, and approval-workflow decisions in docs/meeting-to-sprint-ai-assistant-scope.md.', 40),

  ('development-environment', 'Development configuration', 'Development environment',
   'The isolated AWS Development stack is ready for synthetic local testing.', 'Done',
   'Keep it synthetic-only and verify each later migration before exercising dependent code.', 110),
  ('super-admin-copilot', 'Development configuration', 'Development Super Admin Copilot configuration',
   'The review-only pilot is built; Development OpenAI configuration, feature enablement, and a successful synthetic smoke test remain outstanding.', 'In progress',
   'Securely add a Development-only OPENAI_API_KEY, enable STAFF_COPILOT_SUPER_ADMIN_ENABLED only in Development, restart, and run the approved synthetic Super Admin smoke test.', 120),
  ('development-staff-accounts', 'Development configuration', 'Development staff test accounts',
   'Only the approved synthetic Development accounts currently exist; the full staff-role set is not available for testing.', 'Pending',
   'Create only the additional synthetic role accounts required for Development role and navigation tests.', 130),
  ('aws-setup-review', 'Development configuration', 'AWS setup docs/scripts and migration 0182 review',
   'Development setup documentation, tunnel/setup scripts, and privileged-RPC migration 0182 remain separate from completed product work.', 'Pending',
   'Review their security and recovery behavior, verify 0182 in Development, and commit them separately if approved.', 140),

  ('production-deployment', 'Production readiness', 'Current Vercel Production deployment',
   'The current hosted main deployment is healthy; this does not mean the later AWS Production migration is complete.', 'Done',
   'Keep the hosted Production service stable until every AWS cutover gate and rollback check passes.', 210),
  ('production-staff-smoke-tests', 'Production readiness', 'Production staff role smoke tests',
   'Public availability and anonymous auth gating pass, but authenticated landing, navigation, and core reads are not verified for the live staff-role set.', 'Pending',
   'Run a controlled read-only smoke test with one approved real Production account per required role and record the evidence.', 220),

  ('hosted-uat-decision', 'AWS Production migration', 'No-UAT Production release path decision',
   'Decision confirmed: no hosted UAT environment will be introduced; isolated AWS Development is the test stage before a controlled Production gate.', 'Done',
   'Use explicit Development evidence, Production go/no-go approval, backups, and rollback gates because there is no UAT promotion stage.', 310),
  ('aws-production-target', 'AWS Production migration', 'AWS Production target architecture and security baseline',
   'The Production-sized AWS application and self-hosted Supabase target has not been provisioned or approved.', 'Pending',
   'Approve capacity/cost, encrypted persistent storage, private database exposure, TLS/network controls, least-privilege access, ownership, and patching before provisioning.', 320),
  ('production-backup-restore-rollback', 'AWS Production migration', 'Production backup, restore and rollback plan',
   'No AWS cutover is safe until hosted-source backups, AWS restore evidence, rollback thresholds, and the rollback window are documented and tested.', 'Pending',
   'Define the write-freeze and backup method, run a restore drill, record recovery objectives and owners, and retain the hosted source through the approved rollback window.', 330),
  ('production-data-storage-migration', 'AWS Production migration', 'Production database and Storage migration rehearsal',
   'Production PostgreSQL data, schema/RPC/RLS objects, and Supabase Storage objects still require a non-destructive rehearsal and validation plan.', 'Pending',
   'Inventory scope, rehearse export/import without real-user impact, and reconcile row counts, constraints, permissions, files, checksums, and application reads.', 340),
  ('production-auth-staff-migration', 'AWS Production migration', 'Production Auth and staff-account migration plan',
   'Hosted Auth identities, staff profiles/roles, client identities, password/session behavior, and recovery flows need a controlled migration design.', 'Pending',
   'Map identities without exposing credentials, define password/session transition and recovery, validate role/profile integrity, and plan controlled staff activation.', 350),
  ('aws-production-app-runtime', 'AWS Production migration', 'AWS Production app runtime deployment',
   'The Production app still runs on Vercel; an AWS runtime, private backend path, health checks, and release mechanism are not yet established.', 'Pending',
   'Deploy the app to the approved AWS target with Development-proven configuration and health checks, but keep it off live traffic until cutover approval.', 360),
  ('aws-production-cutover', 'AWS Production migration', 'Controlled AWS Production cutover',
   'The final move from hosted Supabase/Vercel to AWS has not started and must not occur as an ad-hoc configuration switch.', 'Pending',
   'Approve a timed runbook with owners, write freeze, final sync, validation gates, rollback thresholds, communications, and explicit go/no-go before switching traffic.', 370),
  ('production-dns-cutover-verification', 'AWS Production migration', 'Production DNS, TLS and cutover verification',
   'The future AWS endpoints, certificates, DNS records, callback/webhook URLs, and post-switch client paths are not yet verified.', 'Pending',
   'Plan TTLs, validate TLS and all public/auth/webhook routes, switch DNS only at the approved gate, and verify propagation and rollback resolution.', 380),
  ('hosted-production-retirement', 'AWS Production migration', 'Hosted Supabase and Vercel retirement gate',
   'Hosted Production must remain available as the rollback source until AWS stability and data reconciliation pass for the approved observation window.', 'Pending',
   'After formal acceptance and rollback-window expiry, archive evidence and obtain explicit approval before disabling or deleting any hosted resource.', 390),

  ('production-secrets-inventory', 'Security & operations', 'Production secrets and API-key transfer plan',
   'Vercel/Supabase environment variables, API keys, webhook secrets, callback URLs, and ownership must be mapped before AWS can replace the hosted runtime.', 'Pending',
   'Inventory names without exposing values, classify/rotate where required, store them in the approved AWS secret mechanism, and verify each integration at cutover.', 410),
  ('production-monitoring-alerts', 'Security & operations', 'AWS Production monitoring and alerts',
   'AWS host, container, database, gateway, Auth, Storage, app, backup, and capacity failures do not yet have a documented Production alert path.', 'Pending',
   'Define health metrics, log retention, thresholds, alert recipients, escalation, uptime checks, backup-failure alerts, and an incident-response test.', 420),
  ('development-ebs-encryption', 'Security & operations', 'Development EBS encryption decision',
   'The current Development root EBS volume is unencrypted and therefore remains restricted to synthetic data.', 'Pending',
   'Create an encrypted replacement/backup path before any sensitive use, or document explicit synthetic-only risk acceptance and enforcement.', 430),
  ('duplicate-deploy-triggers', 'Security & operations', 'Duplicate Vercel deployment trigger review',
   'A main push can create builds through both native Vercel Git integration and the GitHub deploy hook.', 'Pending',
   'Choose and document one hosted deployment trigger while Vercel remains active; remove redundancy only after release control is confirmed.', 440)
on conflict (item_key) do nothing;

-- Every baseline item has at least one history row. Existing history and later
-- status changes remain append-only and are never rewritten.
insert into workboard_item_history (item_id, from_status, to_status, changed_by_name)
select item.id, null, item.status, 'Migration 0185'
from workboard_items item
where item.item_key in (
  'app-feedback-navigation', 'staff-copilot-framework',
  'super-admin-preview-navigation', 'meeting-to-sprint-assistant',
  'development-environment', 'super-admin-copilot',
  'development-staff-accounts', 'aws-setup-review',
  'production-deployment', 'production-staff-smoke-tests',
  'hosted-uat-decision', 'aws-production-target',
  'production-backup-restore-rollback', 'production-data-storage-migration',
  'production-auth-staff-migration', 'aws-production-app-runtime',
  'aws-production-cutover', 'production-dns-cutover-verification',
  'hosted-production-retirement', 'production-secrets-inventory',
  'production-monitoring-alerts', 'development-ebs-encryption',
  'duplicate-deploy-triggers'
)
and not exists (
  select 1 from workboard_item_history history where history.item_id = item.id
);

-- One idempotent audit marker records the migration-managed backlog upgrade;
-- it contains no secret or client data.
insert into audit_log (actor_name, actor_role, action, target, detail)
select 'Migration 0185', 'System migration', 'Workboard backlog upgraded',
       'Super Admin Workboard',
       'Five workstreams; no-UAT AWS Production path and known remaining gates added'
where not exists (
  select 1 from audit_log
  where actor_name = 'Migration 0185'
    and action = 'Workboard backlog upgraded'
    and target = 'Super Admin Workboard'
);

alter table workboard_items enable trigger workboard_status_guard;

commit;
