-- ============================================================================
-- Cureocity — Health Coach quality-standard governance. Run after 0174.
--
-- Replaces code-embedded draft benchmark percentages with versioned standards.
-- Operations proposes; a different Medical Director approves. Only one version
-- can be active. Content never changes after proposal, and every state change
-- has an append-only event. Metrics remain informational: this schema does not
-- automatically pass, fail, rank or discipline a Health Coach.
-- ============================================================================

begin;

create or replace function coach_quality_targets_valid(target_values jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_typeof(target_values) = 'object'
    and (
      select count(*) = 10
      from jsonb_object_keys(target_values)
    )
    and not exists (
      select 1
      from jsonb_each(target_values) item
      where item.key not in (
        'assessment_completeness', 'measurement_quality', 'goal_quality',
        'if_then_planning', 'scope_compliance', 'referral_quality', 'safety',
        'documentation', 'mdt_coordination', 'client_experience'
      )
      or case
        when jsonb_typeof(item.value) = 'number' then
          (item.value #>> '{}')::numeric < 0
          or (item.value #>> '{}')::numeric > 100
          or trunc((item.value #>> '{}')::numeric) <> (item.value #>> '{}')::numeric
        else true
      end
    ),
    false
  )
$$;

create table if not exists coach_quality_standards (
  id                      uuid primary key default gen_random_uuid(),
  version                 integer not null unique check (version > 0),
  status                  text not null default 'Draft'
                            check (status in ('Draft', 'Approved', 'Retired')),
  targets                 jsonb not null check (coach_quality_targets_valid(targets)),
  review_cadence          text not null
                            check (review_cadence in ('Monthly', 'Quarterly', 'Semiannual')),
  sample_size             smallint not null check (sample_size between 1 and 100),
  coaching_trigger        text not null check (char_length(btrim(coaching_trigger)) >= 12),
  clinical_review_trigger text not null check (char_length(btrim(clinical_review_trigger)) >= 12),
  rationale               text not null check (char_length(btrim(rationale)) >= 12),
  proposed_by             uuid not null references profiles(id) on delete restrict,
  proposed_by_name        text not null,
  proposed_by_role        text not null,
  proposed_at             timestamptz not null default now(),
  approved_by             uuid references profiles(id) on delete restrict,
  approved_by_name        text,
  approved_at             timestamptz,
  approval_note           text,
  retired_by              uuid references profiles(id) on delete restrict,
  retired_by_name         text,
  retired_at              timestamptz,
  retirement_note         text,
  check (
    status <> 'Approved'
    or (approved_by is not null and approved_by_name is not null
        and approved_at is not null and approval_note is not null
        and char_length(btrim(approval_note)) >= 12)
  ),
  check (
    status <> 'Retired'
    or (retired_by is not null and retired_by_name is not null
        and retired_at is not null and retirement_note is not null
        and char_length(btrim(retirement_note)) >= 12)
  )
);

create unique index if not exists coach_quality_one_active_standard_idx
  on coach_quality_standards ((status)) where status = 'Approved';
create index if not exists coach_quality_standards_version_idx
  on coach_quality_standards (version desc);

create table if not exists coach_quality_standard_events (
  id               uuid primary key default gen_random_uuid(),
  standard_id      uuid not null references coach_quality_standards(id) on delete restrict,
  standard_version integer not null,
  event_type       text not null check (event_type in ('Proposed', 'Approved', 'Retired')),
  note             text not null check (char_length(btrim(note)) >= 12),
  actor_id         uuid not null references profiles(id) on delete restrict,
  actor_name       text not null,
  actor_role       text not null,
  created_at       timestamptz not null default now()
);

create index if not exists coach_quality_standard_events_standard_idx
  on coach_quality_standard_events (standard_id, created_at);

create or replace function guard_coach_quality_standard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.version is distinct from new.version
     or old.targets is distinct from new.targets
     or old.review_cadence is distinct from new.review_cadence
     or old.sample_size is distinct from new.sample_size
     or old.coaching_trigger is distinct from new.coaching_trigger
     or old.clinical_review_trigger is distinct from new.clinical_review_trigger
     or old.rationale is distinct from new.rationale
     or old.proposed_by is distinct from new.proposed_by
     or old.proposed_by_name is distinct from new.proposed_by_name
     or old.proposed_by_role is distinct from new.proposed_by_role
     or old.proposed_at is distinct from new.proposed_at then
    raise exception 'A proposed quality standard is immutable; create a new version';
  end if;

  if old.status = 'Draft' and new.status = 'Approved' then
    if new.approved_by is null or new.approved_by_name is null
       or new.approved_at is null or new.approval_note is null
       or char_length(btrim(new.approval_note)) < 12 then
      raise exception 'Approval attribution and reason are required';
    end if;
  elsif old.status in ('Draft', 'Approved') and new.status = 'Retired' then
    if new.retired_by is null or new.retired_by_name is null
       or new.retired_at is null or new.retirement_note is null
       or char_length(btrim(new.retirement_note)) < 12 then
      raise exception 'Retirement attribution and reason are required';
    end if;
  else
    raise exception 'Invalid quality-standard state transition';
  end if;
  return new;
end;
$$;

drop trigger if exists coach_quality_standard_update_guard on coach_quality_standards;
create trigger coach_quality_standard_update_guard
before update on coach_quality_standards
for each row execute function guard_coach_quality_standard_update();

create or replace function propose_coach_quality_standard(
  target_values jsonb,
  target_review_cadence text,
  target_sample_size integer,
  target_coaching_trigger text,
  target_clinical_review_trigger text,
  target_rationale text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_role text;
  next_version integer;
  standard_id uuid;
begin
  select name, role into actor_name, actor_role
  from profiles where id = auth.uid();
  if actor_role is null or actor_role not in ('Super Admin', 'Administrator', 'Manager') then
    raise exception 'Only operational governance can propose a quality standard';
  end if;
  if not coach_quality_targets_valid(target_values)
     or target_review_cadence is null
     or target_review_cadence not in ('Monthly', 'Quarterly', 'Semiannual')
     or target_sample_size is null
     or target_sample_size not between 1 and 100
     or target_coaching_trigger is null
     or char_length(btrim(target_coaching_trigger)) < 12
     or target_clinical_review_trigger is null
     or char_length(btrim(target_clinical_review_trigger)) < 12
     or target_rationale is null
     or char_length(btrim(target_rationale)) < 12 then
    raise exception 'The quality-standard proposal is incomplete';
  end if;

  lock table coach_quality_standards in share row exclusive mode;
  select coalesce(max(version), 0) + 1 into next_version
  from coach_quality_standards;

  insert into coach_quality_standards (
    version, targets, review_cadence, sample_size, coaching_trigger,
    clinical_review_trigger, rationale, proposed_by, proposed_by_name,
    proposed_by_role
  ) values (
    next_version, target_values, target_review_cadence, target_sample_size,
    btrim(target_coaching_trigger), btrim(target_clinical_review_trigger),
    btrim(target_rationale), auth.uid(), actor_name, actor_role
  ) returning id into standard_id;

  insert into coach_quality_standard_events (
    standard_id, standard_version, event_type, note,
    actor_id, actor_name, actor_role
  ) values (
    standard_id, next_version, 'Proposed', btrim(target_rationale),
    auth.uid(), actor_name, actor_role
  );
  return next_version;
end;
$$;

create or replace function approve_coach_quality_standard(
  target_standard_id uuid,
  decision_note text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_role text;
  target coach_quality_standards%rowtype;
  previous coach_quality_standards%rowtype;
begin
  select name, role into actor_name, actor_role
  from profiles where id = auth.uid();
  if actor_role is distinct from 'Medical Director' then
    raise exception 'Only the Medical Director can approve a quality standard';
  end if;
  if decision_note is null or char_length(btrim(decision_note)) < 12 then
    raise exception 'An approval reason of at least 12 characters is required';
  end if;

  lock table coach_quality_standards in share row exclusive mode;
  select * into target from coach_quality_standards
  where id = target_standard_id for update;
  if target.id is null or target.status <> 'Draft' then
    raise exception 'Choose a draft quality standard';
  end if;
  if target.proposed_by = auth.uid() then
    raise exception 'The proposer cannot approve their own quality standard';
  end if;

  for previous in
    select * from coach_quality_standards where status = 'Approved' for update
  loop
    update coach_quality_standards
    set status = 'Retired', retired_by = auth.uid(), retired_by_name = actor_name,
        retired_at = now(),
        retirement_note = format('Superseded by approved version %s. %s', target.version, btrim(decision_note))
    where id = previous.id;
    insert into coach_quality_standard_events (
      standard_id, standard_version, event_type, note,
      actor_id, actor_name, actor_role
    ) values (
      previous.id, previous.version, 'Retired',
      format('Superseded by approved version %s. %s', target.version, btrim(decision_note)),
      auth.uid(), actor_name, actor_role
    );
  end loop;

  update coach_quality_standards
  set status = 'Approved', approved_by = auth.uid(), approved_by_name = actor_name,
      approved_at = now(), approval_note = btrim(decision_note)
  where id = target.id;
  insert into coach_quality_standard_events (
    standard_id, standard_version, event_type, note,
    actor_id, actor_name, actor_role
  ) values (
    target.id, target.version, 'Approved', btrim(decision_note),
    auth.uid(), actor_name, actor_role
  );
  return target.version;
end;
$$;

create or replace function retire_coach_quality_standard(
  target_standard_id uuid,
  decision_note text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_role text;
  target coach_quality_standards%rowtype;
begin
  select name, role into actor_name, actor_role
  from profiles where id = auth.uid();
  if actor_role is distinct from 'Medical Director' then
    raise exception 'Only the Medical Director can retire a quality standard';
  end if;
  if decision_note is null or char_length(btrim(decision_note)) < 12 then
    raise exception 'A retirement reason of at least 12 characters is required';
  end if;

  select * into target from coach_quality_standards
  where id = target_standard_id for update;
  if target.id is null or target.status not in ('Draft', 'Approved') then
    raise exception 'Choose a current draft or approved quality standard';
  end if;

  update coach_quality_standards
  set status = 'Retired', retired_by = auth.uid(), retired_by_name = actor_name,
      retired_at = now(), retirement_note = btrim(decision_note)
  where id = target.id;
  insert into coach_quality_standard_events (
    standard_id, standard_version, event_type, note,
    actor_id, actor_name, actor_role
  ) values (
    target.id, target.version, 'Retired', btrim(decision_note),
    auth.uid(), actor_name, actor_role
  );
  return target.version;
end;
$$;

alter table coach_quality_standards enable row level security;
alter table coach_quality_standard_events enable row level security;

drop policy if exists coach_quality_standards_read on coach_quality_standards;
create policy coach_quality_standards_read on coach_quality_standards for select
  using (is_admin() or (is_staff() and status = 'Approved'));
-- No direct INSERT / UPDATE / DELETE policies. The guarded functions above are
-- the only authenticated mutation path.

drop policy if exists coach_quality_standard_events_read on coach_quality_standard_events;
create policy coach_quality_standard_events_read on coach_quality_standard_events for select
  using (is_admin());
-- Events are append-only and are written only by the guarded functions.

revoke all on function propose_coach_quality_standard(jsonb, text, integer, text, text, text) from public;
revoke all on function approve_coach_quality_standard(uuid, text) from public;
revoke all on function retire_coach_quality_standard(uuid, text) from public;
grant execute on function propose_coach_quality_standard(jsonb, text, integer, text, text, text) to authenticated;
grant execute on function approve_coach_quality_standard(uuid, text) to authenticated;
grant execute on function retire_coach_quality_standard(uuid, text) to authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table coach_quality_standards'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table coach_quality_standard_events'; exception when others then null; end;
end $$;

commit;
