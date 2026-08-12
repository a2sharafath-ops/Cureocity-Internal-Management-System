-- ============================================================================
-- Cureocity — Health Coach 360: assigned-client write ownership.
-- Run after 0173.
--
-- Health Coach records were discipline-owned, but every Health Coach could
-- still mutate every client's record. The formal coach client_assignments row
-- is now required at the database boundary. is_admin() remains the RLS escape
-- hatch for Administrator / Super Admin / Manager / Medical Director; the app
-- requires a reason and writes that supervisor override to audit_log.
--
-- Safety events are deliberately not changed here. Any authorised clinician
-- who recognises an urgent concern must be able to open and escalate it even
-- when they are not the assigned coach.
-- ============================================================================

begin;

create or replace function is_assigned_health_coach(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    my_role() = 'Health Coach'
    and my_staff_id() is not null
    and exists (
      select 1
      from client_assignments assignment
      where assignment.client_id = target_client_id
        and assignment.discipline = 'coach'
        and assignment.staff_id = my_staff_id()
    ),
    false
  )
$$;

comment on function is_assigned_health_coach(uuid) is
  'True only when the caller is the Health Coach in the client care-team assignment.';

create or replace function can_write_health_coach_client(target_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(is_admin() or is_assigned_health_coach(target_client_id), false)
$$;

comment on function can_write_health_coach_client(uuid) is
  'Assigned Health Coach or cross-discipline supervisor. Supervisor reasons are enforced and audited by server actions.';

-- ---- behaviour goals, adherence, barriers and wearable records ------------

drop policy if exists habits_write on habits;
create policy habits_write on habits for all
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

drop policy if exists hl_staff_write on habit_logs;
create policy hl_staff_write on habit_logs for all
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

drop policy if exists wc_staff_write on wearable_connections;
create policy wc_staff_write on wearable_connections for all
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

drop policy if exists wr_staff_write on wearable_readings;
create policy wr_staff_write on wearable_readings for all
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

drop policy if exists coach_goal_events_insert on coach_goal_events;
create policy coach_goal_events_insert on coach_goal_events for insert
  with check (
    actor_id = auth.uid()
    and can_write_health_coach_client(client_id)
  );

drop policy if exists coach_adherence_events_insert on coach_adherence_events;
create policy coach_adherence_events_insert on coach_adherence_events for insert
  with check (
    recorded_by = auth.uid()
    and can_write_health_coach_client(client_id)
  );

drop policy if exists coach_barriers_insert on coach_barriers;
drop policy if exists coach_barriers_update on coach_barriers;
create policy coach_barriers_insert on coach_barriers for insert
  with check (
    created_by = auth.uid()
    and can_write_health_coach_client(client_id)
  );
create policy coach_barriers_update on coach_barriers for update
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

-- ---- baseline, screening and structured session ---------------------------

drop policy if exists coach_baselines_write on coach_baselines;
create policy coach_baselines_write on coach_baselines for all
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

drop policy if exists coach_baseline_events_insert on coach_baseline_events;
create policy coach_baseline_events_insert on coach_baseline_events for insert
  with check (
    actor_id = auth.uid()
    and can_write_health_coach_client(client_id)
  );

drop policy if exists coach_assessments_write on coach_assessments;
create policy coach_assessments_write on coach_assessments for all
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

drop policy if exists coach_session_workflows_write on coach_session_workflows;
create policy coach_session_workflows_write on coach_session_workflows for all
  using (can_write_health_coach_client(client_id))
  with check (can_write_health_coach_client(client_id));

drop policy if exists coach_session_events_insert on coach_session_events;
create policy coach_session_events_insert on coach_session_events for insert
  with check (
    actor_id = auth.uid()
    and can_write_health_coach_client(client_id)
  );

-- Copilot actions already enforce assigned ownership in the server. Mirror it
-- here so a direct authenticated table call cannot generate/accept for another
-- coach's client.
drop policy if exists coach_copilot_drafts_insert on coach_copilot_drafts;
drop policy if exists coach_copilot_drafts_update on coach_copilot_drafts;
create policy coach_copilot_drafts_insert on coach_copilot_drafts for insert
  with check (
    created_by = auth.uid()
    and can_write_health_coach_client(client_id)
  );
create policy coach_copilot_drafts_update on coach_copilot_drafts for update
  using (
    created_by = auth.uid()
    and can_write_health_coach_client(client_id)
  )
  with check (
    created_by = auth.uid()
    and can_write_health_coach_client(client_id)
  );

-- ---- clinical referrals ---------------------------------------------------
-- Preserve normal destination/creator access for Doctors, Dietitians,
-- Trainers and Psychologists. Only the Health Coach branch is narrowed to the
-- formal coach assignment; supervisors retain their existing RLS oversight.

drop policy if exists clinical_referrals_insert on clinical_referrals;
create policy clinical_referrals_insert on clinical_referrals for insert
  with check (
    created_by = auth.uid()
    and my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach',
      'Psychologist', 'Medical Director'
    )
    and (
      my_role() <> 'Health Coach'
      or is_assigned_health_coach(client_id)
    )
  );

drop policy if exists clinical_referrals_update on clinical_referrals;
create policy clinical_referrals_update on clinical_referrals for update
  using (
    (
      is_admin()
      or created_by = auth.uid()
      or destination_role = my_role()
      or assigned_to_staff_id = my_staff_id()
    )
    and (
      my_role() <> 'Health Coach'
      or is_assigned_health_coach(client_id)
    )
  )
  with check (
    (
      is_admin()
      or created_by = auth.uid()
      or destination_role = my_role()
      or assigned_to_staff_id = my_staff_id()
    )
    and (
      my_role() <> 'Health Coach'
      or is_assigned_health_coach(client_id)
    )
  );

drop policy if exists clinical_referral_events_insert on clinical_referral_events;
create policy clinical_referral_events_insert on clinical_referral_events for insert
  with check (
    actor_id = auth.uid()
    and (is_admin() or my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach', 'Psychologist'
    ))
    and (
      my_role() <> 'Health Coach'
      or exists (
        select 1
        from clinical_referrals referral
        where referral.id = referral_id
          and is_assigned_health_coach(referral.client_id)
      )
    )
  );

commit;
