-- ============================================================================
-- Cureocity — Super Admin Workboard.
-- Run after 0183.
--
-- Forward-only. Creates a durable owner sprint board, seeds only the explicitly
-- approved current-state baseline, and records every status change in both an
-- append-only item history and the existing audit log. It does not apply any
-- of the work described by the seeded items.
-- ============================================================================

begin;

create table if not exists workboard_items (
  id              uuid primary key default gen_random_uuid(),
  item_key        text not null unique,
  workstream      text not null,
  title           text not null,
  state_note      text not null,
  status          text not null check (status in ('Pending', 'In progress', 'Done')),
  next_action     text not null,
  sort_order      integer not null check (sort_order > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid,
  updated_by_name text,
  version         integer not null default 1 check (version > 0)
);

create index if not exists workboard_items_status_order_idx
  on workboard_items (status, sort_order);

create table if not exists workboard_item_history (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references workboard_items(id) on delete restrict,
  from_status     text check (from_status is null or from_status in ('Pending', 'In progress', 'Done')),
  to_status       text not null check (to_status in ('Pending', 'In progress', 'Done')),
  changed_by      uuid,
  changed_by_name text,
  changed_at      timestamptz not null default now()
);

create index if not exists workboard_item_history_item_time_idx
  on workboard_item_history (item_id, changed_at desc);
create index if not exists workboard_item_history_time_idx
  on workboard_item_history (changed_at desc);

insert into workboard_items (item_key, workstream, title, state_note, status, next_action, sort_order) values
  ('app-feedback-navigation', 'Staff experience', 'App Feedback navigation', 'Available to authenticated staff in the sidebar; administrator triage remains separate.', 'Done', 'Monitor staff usage and triage submitted app feedback.', 10),
  ('staff-copilot-framework', 'Staff copilot', 'Staff copilot framework', 'Role-aware staff framework and safeguards are built.', 'Done', 'Keep unapproved roles inert until their allowed tasks and boundaries are defined.', 20),
  ('super-admin-copilot', 'Staff copilot', 'Super Admin copilot', 'Built; Development configuration is pending.', 'In progress', 'Complete Development-only configuration and run the approved synthetic smoke test.', 30),
  ('development-environment', 'Environments', 'Development environment', 'Ready for isolated testing with synthetic data.', 'Done', 'Continue testing only with synthetic Development accounts and data.', 40),
  ('production-deployment', 'Release', 'Production deployment', 'Current main deployment completed successfully.', 'Done', 'Keep Production unchanged until the staff-readiness checks are complete.', 50),
  ('production-staff-smoke-tests', 'Release', 'Production staff-readiness smoke tests', 'Not yet verified for the full staff role set.', 'Pending', 'Verify the staff-facing domain and sign-in plus landing-page access for one account per role.', 60),
  ('development-staff-accounts', 'Environments', 'Development staff test accounts', 'Only the approved synthetic Development accounts currently exist.', 'Pending', 'Create only the additional synthetic role accounts needed for Development testing.', 70),
  ('super-admin-preview-navigation', 'Navigation', 'Super Admin preview navigation clarification', 'The role-preview state can make clinical workspace navigation look native to Super Admin.', 'Pending', 'Clarify preview labels and keep native Super Admin navigation distinct from clinician preview.', 80),
  ('hosted-uat-decision', 'Environments', 'Hosted UAT decision', 'No hosted UAT environment currently exists.', 'Pending', 'Decide whether to provision a hosted UAT app and isolated backend before introducing a promotion workflow.', 90),
  ('aws-setup-review', 'Infrastructure', 'AWS setup docs/scripts review and separate commit', 'Development setup files remain separate from completed product work.', 'Pending', 'Review the AWS documentation, tunnel/setup scripts, and migration 0182, then commit them separately if approved.', 100),
  ('duplicate-deploy-triggers', 'Release', 'Duplicate deployment triggers review', 'A main push can still create duplicate Vercel Production triggers.', 'Pending', 'Choose one deployment trigger after confirming which path is the required release control.', 110),
  ('meeting-to-sprint-assistant', 'AI planning', 'Meeting-to-Sprint AI Assistant', 'Review-first concept only; recording, transcription, AI calls, integrations, task assignment, and financial actions are not implemented.', 'Pending', 'Resolve the consent, retention, approved-data, provider, and approval-workflow decisions in docs/meeting-to-sprint-ai-assistant-scope.md before implementation.', 120)
on conflict (item_key) do nothing;

-- One baseline history row per seeded item. Re-running the migration does not
-- duplicate history and does not overwrite a Super Admin's later status.
insert into workboard_item_history (item_id, from_status, to_status)
select item.id, null, item.status
from workboard_items item
where item.item_key in (
  'app-feedback-navigation', 'staff-copilot-framework', 'super-admin-copilot',
  'development-environment', 'production-deployment', 'production-staff-smoke-tests',
  'development-staff-accounts', 'super-admin-preview-navigation', 'hosted-uat-decision',
  'aws-setup-review', 'duplicate-deploy-triggers', 'meeting-to-sprint-assistant'
)
and not exists (
  select 1 from workboard_item_history history where history.item_id = item.id
);

create or replace function enforce_workboard_status_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_name text;
  actor_role text;
begin
  select profiles.name, profiles.role into actor_name, actor_role
  from profiles where profiles.id = auth.uid();

  if actor_role is distinct from 'Super Admin' then
    raise exception 'Super Admin access is required';
  end if;

  if old.item_key is distinct from new.item_key
     or old.workstream is distinct from new.workstream
     or old.title is distinct from new.title
     or old.state_note is distinct from new.state_note
     or old.next_action is distinct from new.next_action
     or old.sort_order is distinct from new.sort_order
     or old.created_at is distinct from new.created_at then
    raise exception 'Workboard item content is migration-managed';
  end if;

  if new.status is not distinct from old.status then
    return old;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  new.updated_by_name := actor_name;
  new.version := old.version + 1;

  insert into workboard_item_history (
    item_id, from_status, to_status, changed_by, changed_by_name, changed_at
  ) values (
    old.id, old.status, new.status, auth.uid(), actor_name, new.updated_at
  );

  insert into audit_log (actor_id, actor_name, actor_role, action, target, detail, created_at)
  values (
    auth.uid(), actor_name, actor_role, 'Workboard status changed', old.title,
    old.status || ' -> ' || new.status, new.updated_at
  );

  return new;
end;
$$;

drop trigger if exists workboard_status_guard on workboard_items;
create trigger workboard_status_guard
before update on workboard_items
for each row execute function enforce_workboard_status_update();

alter table workboard_items enable row level security;
alter table workboard_item_history enable row level security;

drop policy if exists workboard_items_super_admin_read on workboard_items;
drop policy if exists workboard_items_super_admin_update on workboard_items;
drop policy if exists workboard_history_super_admin_read on workboard_item_history;

create policy workboard_items_super_admin_read on workboard_items for select
  using (my_role() = 'Super Admin');
create policy workboard_items_super_admin_update on workboard_items for update
  using (my_role() = 'Super Admin')
  with check (my_role() = 'Super Admin');
create policy workboard_history_super_admin_read on workboard_item_history for select
  using (my_role() = 'Super Admin');

revoke all on table workboard_items from anon, authenticated;
revoke all on table workboard_item_history from anon, authenticated;
grant select on table workboard_items to authenticated;
grant update (status) on table workboard_items to authenticated;
grant select on table workboard_item_history to authenticated;

revoke execute on function enforce_workboard_status_update() from public, anon, authenticated;

commit;
