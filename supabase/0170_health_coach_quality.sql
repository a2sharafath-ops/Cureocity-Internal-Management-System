-- ============================================================================
-- Cureocity — Health Coach 360 phase 7: immutable session quality reviews.
-- Run after 0169.
--
-- Operational KPIs are calculated live from existing care records. This table
-- stores only the human review that software cannot safely infer: scope,
-- referral judgement, safety handling and collaborative language.
-- ============================================================================

begin;

create table if not exists coach_quality_reviews (
  id              uuid primary key default gen_random_uuid(),
  workflow_id     uuid not null references coach_session_workflows(id) on delete restrict,
  consultation_id uuid not null references consultations(id) on delete restrict,
  client_id       uuid not null references clients(id) on delete cascade,
  coach_id        uuid not null,
  coach_name      text not null,
  session_number  integer not null check (session_number > 0),
  ratings         jsonb not null,
  overall_result  text not null check (overall_result in (
    'Meets standard', 'Needs coaching', 'Clinical review required'
  )),
  reviewer_note   text,
  reviewer_id     uuid not null default auth.uid(),
  reviewer_name   text not null,
  reviewer_role   text not null,
  reviewed_at     timestamptz not null default now(),
  check (overall_result = 'Meets standard' or nullif(btrim(reviewer_note), '') is not null)
);

create index if not exists coach_quality_reviews_workflow_idx
  on coach_quality_reviews (workflow_id, reviewed_at desc);
create index if not exists coach_quality_reviews_coach_idx
  on coach_quality_reviews (coach_id, reviewed_at desc);

create or replace function guard_coach_quality_subject()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_consultation uuid;
  linked_client uuid;
  linked_coach uuid;
  linked_coach_name text;
  linked_session integer;
  linked_status text;
begin
  select consultation_id, client_id, completed_by, completed_by_name, session_number, status
    into linked_consultation, linked_client, linked_coach, linked_coach_name, linked_session, linked_status
  from coach_session_workflows
  where id = new.workflow_id;

  if linked_status is distinct from 'Completed'
     or linked_consultation is distinct from new.consultation_id
     or linked_client is distinct from new.client_id
     or linked_coach is distinct from new.coach_id
     or linked_coach_name is distinct from new.coach_name
     or linked_session is distinct from new.session_number then
    raise exception 'Quality review must match a completed Health Coach session';
  end if;
  return new;
end;
$$;

drop trigger if exists coach_quality_subject_guard on coach_quality_reviews;
create trigger coach_quality_subject_guard
before insert or update of workflow_id, consultation_id, client_id, coach_id, coach_name, session_number
on coach_quality_reviews
for each row execute function guard_coach_quality_subject();

alter table coach_quality_reviews enable row level security;

drop policy if exists coach_quality_reviews_read on coach_quality_reviews;
drop policy if exists coach_quality_reviews_insert on coach_quality_reviews;
create policy coach_quality_reviews_read on coach_quality_reviews for select
  using (is_admin() or reviewer_id = auth.uid() or coach_id = auth.uid());
create policy coach_quality_reviews_insert on coach_quality_reviews for insert
  with check (reviewer_id = auth.uid() and is_admin());
-- Reviews are permanent. A later reviewer adds another record rather than
-- editing or deleting the earlier judgement.

do $$ begin
  begin execute 'alter publication supabase_realtime add table coach_quality_reviews'; exception when others then null; end;
end $$;

commit;
