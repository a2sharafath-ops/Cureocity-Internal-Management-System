-- ============================================================================
-- Cureocity — per-discipline care-team assignment. Run after 0070.
--
-- clients.pro_id only ever held ONE staff member, so a client couldn't have a
-- doctor and a dietitian and a trainer at the same time. This adds a row per
-- (client, discipline), records how the assignment was made, and keeps
-- clients.pro_id as the derived "primary pro" for the existing list view.
-- ============================================================================

create table if not exists client_assignments (
  client_id   uuid not null references clients(id) on delete cascade,
  discipline  text not null check (discipline in ('doctor','dietitian','psychologist','coach','trainer')),
  staff_id    text references staff(id) on delete set null,
  method      text not null default 'rotation' check (method in ('booking','rotation','manual')),
  assigned_by text,
  assigned_at timestamptz not null default now(),
  primary key (client_id, discipline)
);

create index if not exists client_assignments_staff_idx on client_assignments (staff_id);

alter table client_assignments enable row level security;

drop policy if exists ca_read  on client_assignments;
drop policy if exists ca_write on client_assignments;
drop policy if exists ca_client_read on client_assignments;

-- Any staff member may see who is on a client's care team; only admins and
-- managers may change it (the assignment engine runs as the acting user).
create policy ca_read  on client_assignments for select using (is_staff());
create policy ca_write on client_assignments for all
  using (is_admin() or my_role() = 'Manager')
  with check (is_admin() or my_role() = 'Manager');
-- a client can see their own care team in the portal
create policy ca_client_read on client_assignments for select using (client_id = my_client_id());

-- ---------------------------------------------------------------------------
-- Backfill: carry the existing single pro_id across as a manual assignment so
-- nothing looks unassigned immediately after deploy.
insert into client_assignments (client_id, discipline, staff_id, method, assigned_by)
select c.id, d.discipline, s.id, 'manual', 'migration 0071'
from clients c
join staff s on s.id = c.pro_id
join lateral (
  select case s.role
           when 'Doctor'          then 'doctor'
           when 'Dietitian'       then 'dietitian'
           when 'Psychologist'    then 'psychologist'
           when 'Health Coach'    then 'coach'
           when 'Fitness Trainer' then 'trainer'
           else null
         end as discipline
) d on d.discipline is not null
on conflict (client_id, discipline) do nothing;
