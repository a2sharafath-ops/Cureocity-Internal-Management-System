-- ============================================================================
-- Cureocity — workspace Phase 2: client Concerns queue + MDT board. Run after 0060.
--
--  • concerns  — client-raised concerns routed to a discipline workspace.
--  • mdt_notes — multidisciplinary team notes / escalations on a client.
-- ============================================================================

create table if not exists concerns (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  role        text not null,                         -- doctor | diet | trainer | coach | general
  category    text,
  body        text not null,
  raised_by   text,                                  -- 'Client' or staff name
  status      text not null default 'Open',          -- Open | Resolved
  resolved_by text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists concerns_role_idx   on concerns (role);
create index if not exists concerns_status_idx on concerns (status);

create table if not exists mdt_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete set null,
  author     text,                                   -- staff name
  body       text not null,
  escalated  boolean not null default false,
  to_role    text,                                   -- escalation target discipline
  status     text,                                   -- escalations: Open | Acknowledged
  created_at timestamptz not null default now()
);
create index if not exists mdt_notes_client_idx on mdt_notes (client_id);

alter table concerns  enable row level security;
alter table mdt_notes enable row level security;

drop policy if exists concerns_staff on concerns;
create policy concerns_staff on concerns for all using (is_staff()) with check (is_staff());
drop policy if exists concerns_client on concerns;
create policy concerns_client on concerns for select using (client_id = my_client_id());

drop policy if exists mdt_staff on mdt_notes;
create policy mdt_staff on mdt_notes for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table concerns';  exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table mdt_notes';  exception when others then null; end;
end $$;

-- ---- seed (only if empty) --------------------------------------------------
insert into concerns (client_id, role, category, body, raised_by, status)
select c.id, v.role, v.category, v.body, 'Client', v.status
from (values
  ('CUR-002', 'diet',    'Diet',    'The diet chart feels heavy on rice for my sugar levels — can it be adjusted?', 'Open'),
  ('CUR-001', 'trainer', 'Fitness', 'Knee still aches after the last session — worried about the exercises.',       'Open'),
  ('CUR-002', 'doctor',  'Medical', 'Felt light-headed after fasting bloodwork — should I be concerned?',           'Resolved')
) as v(code, role, category, body, status)
join clients c on c.code = v.code
where not exists (select 1 from concerns);

insert into mdt_notes (client_id, author, body, escalated, to_role, status)
select c.id, v.author, v.body, v.esc, v.to_role, v.status
from (values
  ('CUR-002', 'Dr. Priya',   'Adherence ~80%; night cravings — added a 9 PM protein snack to the chart.', false, null,      null),
  ('CUR-001', 'Coach Babith', 'Knee pain reducing; cleared for step-ups from next week.',                 false, null,      null),
  ('CUR-002', 'Diet Anjana',  'Prediabetes + high cholesterol — needs a medical review of current plan.', true,  'doctor',  'Open')
) as v(code, author, body, esc, to_role, status)
join clients c on c.code = v.code
where not exists (select 1 from mdt_notes);
