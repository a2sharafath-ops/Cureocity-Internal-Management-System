-- ============================================================================
-- Cureocity — Health Coach 360 foundation. Run after 0164.
--
-- Adds two clinical coordination records that must not be confused with the
-- existing customer-referral feature:
--   • clinical_referrals — warm hand-offs between members of the care team
--   • safety_events      — persistent clinical hard stops with human closure
--
-- It also makes the SOP's scope boundaries real at the database layer:
-- Health Coaches own habits/wearables, Fitness Trainers own workout plans and
-- Dietitians own diet plans. All clinical staff may still read these records.
-- ============================================================================

begin;

-- ---- clinical referrals ----------------------------------------------------

create table if not exists clinical_referrals (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id) on delete cascade,
  reason               text not null,
  destination_role     text not null check (destination_role in (
    'Doctor', 'Dietitian', 'Fitness Trainer', 'Psychologist', 'Medical Director'
  )),
  urgency              text not null default 'Routine'
                         check (urgency in ('Routine', 'Priority', 'Urgent')),
  requested_action     text,
  consent_status       text not null default 'Not recorded'
                         check (consent_status in ('Not recorded', 'Obtained', 'Declined', 'Not required')),
  assigned_to_staff_id text references staff(id) on delete set null,
  status               text not null default 'Sent' check (status in (
    'Draft', 'Sent', 'Acknowledged', 'Scheduled', 'Completed',
    'Declined', 'Unable to contact', 'Cancelled'
  )),
  created_by           uuid not null default auth.uid(),
  created_by_name      text not null,
  acknowledged_by      text,
  acknowledged_at      timestamptz,
  completed_by         text,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists clinical_referrals_client_idx
  on clinical_referrals (client_id, status, created_at desc);
create index if not exists clinical_referrals_destination_idx
  on clinical_referrals (destination_role, status, created_at desc);

-- Immutable status/note history. A correction is another event, never an edit
-- to the original audit trail.
create table if not exists clinical_referral_events (
  id            uuid primary key default gen_random_uuid(),
  referral_id   uuid not null references clinical_referrals(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  note          text,
  actor_id      uuid not null default auth.uid(),
  actor_name    text not null,
  actor_role    text not null,
  created_at    timestamptz not null default now()
);

create index if not exists clinical_referral_events_referral_idx
  on clinical_referral_events (referral_id, created_at);

alter table clinical_referrals       enable row level security;
alter table clinical_referral_events enable row level security;

drop policy if exists clinical_referrals_read   on clinical_referrals;
drop policy if exists clinical_referrals_insert on clinical_referrals;
drop policy if exists clinical_referrals_update on clinical_referrals;
create policy clinical_referrals_read on clinical_referrals for select
  using (is_staff());
create policy clinical_referrals_insert on clinical_referrals for insert
  with check (
    created_by = auth.uid()
    and my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach',
      'Psychologist', 'Medical Director'
    )
  );
create policy clinical_referrals_update on clinical_referrals for update
  using (
    is_admin()
    or created_by = auth.uid()
    or destination_role = my_role()
    or assigned_to_staff_id = my_staff_id()
  )
  with check (
    is_admin()
    or created_by = auth.uid()
    or destination_role = my_role()
    or assigned_to_staff_id = my_staff_id()
  );
-- Deliberately no DELETE policy: a clinical referral is cancelled, not erased.

drop policy if exists clinical_referral_events_read   on clinical_referral_events;
drop policy if exists clinical_referral_events_insert on clinical_referral_events;
create policy clinical_referral_events_read on clinical_referral_events for select
  using (is_staff());
create policy clinical_referral_events_insert on clinical_referral_events for insert
  with check (
    actor_id = auth.uid()
    and (is_admin() or my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach', 'Psychologist'
    ))
  );
-- No UPDATE or DELETE policy: this is an append-only history.


-- ---- safety hard stops -----------------------------------------------------

create table if not exists safety_events (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id) on delete cascade,
  trigger_type         text not null check (trigger_type in (
    'Positive self-harm response', 'New exercise symptom',
    'Substance or withdrawal concern', 'Other urgent concern'
  )),
  concern_summary      text not null,
  immediate_action     text not null,
  recipient_role       text not null default 'Medical Director'
                         check (recipient_role in ('Medical Director', 'Doctor')),
  assigned_to_staff_id text references staff(id) on delete set null,
  status               text not null default 'Open'
                         check (status in ('Open', 'Acknowledged', 'Resolved')),
  opened_by            uuid not null default auth.uid(),
  opened_by_name       text not null,
  opened_by_role       text not null,
  opened_at            timestamptz not null default now(),
  acknowledged_by      text,
  acknowledged_at      timestamptz,
  resolved_by          text,
  resolved_at          timestamptz,
  resolution_note      text,
  updated_at           timestamptz not null default now(),
  check (status <> 'Acknowledged' or (acknowledged_by is not null and acknowledged_at is not null)),
  check (status <> 'Resolved' or (
    acknowledged_by is not null and acknowledged_at is not null
    and resolved_by is not null and resolved_at is not null
    and nullif(btrim(resolution_note), '') is not null
  ))
);

create index if not exists safety_events_client_idx
  on safety_events (client_id, status, opened_at desc);
create index if not exists safety_events_open_idx
  on safety_events (status, opened_at) where status <> 'Resolved';

create table if not exists safety_event_actions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references safety_events(id) on delete cascade,
  action_type text not null check (action_type in (
    'Created', 'Escalated', 'Note', 'Acknowledged', 'Resolved'
  )),
  note        text,
  actor_id    uuid not null default auth.uid(),
  actor_name  text not null,
  actor_role  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists safety_event_actions_event_idx
  on safety_event_actions (event_id, created_at);

alter table safety_events        enable row level security;
alter table safety_event_actions enable row level security;

drop policy if exists safety_events_read   on safety_events;
drop policy if exists safety_events_insert on safety_events;
drop policy if exists safety_events_update on safety_events;
create policy safety_events_read on safety_events for select
  using (is_staff());
create policy safety_events_insert on safety_events for insert
  with check (
    opened_by = auth.uid()
    and status = 'Open'
    and my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach',
      'Psychologist', 'Medical Director'
    )
  );
create policy safety_events_update on safety_events for update
  using (my_role() in ('Doctor', 'Medical Director'))
  with check (my_role() in ('Doctor', 'Medical Director'));
-- No DELETE policy. Safety records are permanent clinical records.

drop policy if exists safety_event_actions_read   on safety_event_actions;
drop policy if exists safety_event_actions_insert on safety_event_actions;
create policy safety_event_actions_read on safety_event_actions for select
  using (is_staff());
create policy safety_event_actions_insert on safety_event_actions for insert
  with check (
    actor_id = auth.uid()
    and (
      action_type in ('Created', 'Escalated', 'Note')
      or (action_type in ('Acknowledged', 'Resolved')
          and my_role() in ('Doctor', 'Medical Director'))
    )
  );
-- No UPDATE or DELETE policy: safety history is append-only.


-- ---- enforce clinical ownership on existing records -----------------------

-- Workout plans: readable by the team, writable only by the trainer or
-- cross-discipline clinical oversight. The portal keeps its own read policy.
drop policy if exists cw_staff on client_workouts;
drop policy if exists cw_read  on client_workouts;
drop policy if exists cw_write on client_workouts;
create policy cw_read on client_workouts for select using (is_staff());
create policy cw_write on client_workouts for all
  using (is_admin() or my_role() = 'Fitness Trainer')
  with check (is_admin() or my_role() = 'Fitness Trainer');

-- Health Coach-owned behaviour records. Clients retain their existing own-row
-- read/write policies for portal check-offs and manual device readings.
drop policy if exists habits_staff on habits;
drop policy if exists habits_read  on habits;
drop policy if exists habits_write on habits;
create policy habits_read on habits for select using (is_staff());
create policy habits_write on habits for all
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');

drop policy if exists hl_staff on habit_logs;
drop policy if exists hl_staff_read  on habit_logs;
drop policy if exists hl_staff_write on habit_logs;
create policy hl_staff_read on habit_logs for select using (is_staff());
create policy hl_staff_write on habit_logs for all
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');

drop policy if exists wc_staff on wearable_connections;
drop policy if exists wc_staff_read  on wearable_connections;
drop policy if exists wc_staff_write on wearable_connections;
create policy wc_staff_read on wearable_connections for select using (is_staff());
create policy wc_staff_write on wearable_connections for all
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');

drop policy if exists wr_staff on wearable_readings;
drop policy if exists wr_staff_read  on wearable_readings;
drop policy if exists wr_staff_write on wearable_readings;
create policy wr_staff_read on wearable_readings for select using (is_staff());
create policy wr_staff_write on wearable_readings for all
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');

-- Newer customised diet-plan tables were created after the original
-- discipline policies and still had blanket staff writes. Tighten the parent
-- and child records together.
drop policy if exists diet_plans_staff on diet_plans;
drop policy if exists diet_plans_read  on diet_plans;
drop policy if exists diet_plans_write on diet_plans;
create policy diet_plans_read on diet_plans for select using (is_staff());
create policy diet_plans_write on diet_plans for all
  using (is_admin() or my_role() = 'Dietitian')
  with check (is_admin() or my_role() = 'Dietitian');

drop policy if exists diet_plan_meals_staff on diet_plan_meals;
drop policy if exists diet_plan_meals_read  on diet_plan_meals;
drop policy if exists diet_plan_meals_write on diet_plan_meals;
create policy diet_plan_meals_read on diet_plan_meals for select using (is_staff());
create policy diet_plan_meals_write on diet_plan_meals for all
  using (is_admin() or my_role() = 'Dietitian')
  with check (is_admin() or my_role() = 'Dietitian');

drop policy if exists diet_plan_options_staff on diet_plan_options;
drop policy if exists diet_plan_options_read  on diet_plan_options;
drop policy if exists diet_plan_options_write on diet_plan_options;
create policy diet_plan_options_read on diet_plan_options for select using (is_staff());
create policy diet_plan_options_write on diet_plan_options for all
  using (is_admin() or my_role() = 'Dietitian')
  with check (is_admin() or my_role() = 'Dietitian');

drop policy if exists diet_assessments_staff on diet_assessments;
drop policy if exists diet_assessments_read  on diet_assessments;
drop policy if exists diet_assessments_write on diet_assessments;
create policy diet_assessments_read on diet_assessments for select using (is_staff());
create policy diet_assessments_write on diet_assessments for all
  using (is_admin() or my_role() = 'Dietitian')
  with check (is_admin() or my_role() = 'Dietitian');


-- ---- realtime -------------------------------------------------------------

do $$ begin
  begin execute 'alter publication supabase_realtime add table clinical_referrals'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table safety_events'; exception when others then null; end;
end $$;

commit;
