-- ============================================================================
-- Cureocity — workspace Phase 3: role-scoped Resource Library. Run after 0061.
--
-- Staff-only file library scoped to a discipline workspace. role='all' files
-- (shared MDT resources) surface in every workspace. Separate from client PHI
-- files (0008) — these are templates, handouts, protocols, etc.
-- ============================================================================

create table if not exists resource_files (
  id          uuid primary key default gen_random_uuid(),
  role        text not null default 'all',   -- doctor | diet | trainer | coach | all
  folder      text not null default 'General',
  name        text not null,
  bucket      text not null default 'resources',
  path        text,                           -- storage path (null = metadata-only sample)
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists resource_files_role_idx on resource_files (role);

alter table resource_files enable row level security;
drop policy if exists resource_files_staff on resource_files;
create policy resource_files_staff on resource_files for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table resource_files'; exception when others then null; end;
end $$;

-- ---- storage bucket (staff-only) -------------------------------------------
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

drop policy if exists "res staff all" on storage.objects;
create policy "res staff all" on storage.objects for all
  using (bucket_id = 'resources' and is_staff())
  with check (bucket_id = 'resources' and is_staff());

-- ---- seed (metadata-only samples; only if empty) ---------------------------
insert into resource_files (role, folder, name, uploaded_by)
select v.role, v.folder, v.name, 'System'
from (values
  ('diet',    'Diet Templates', 'Diet-Chart-Template-v3.xlsx'),
  ('diet',    'Recipes',        'Healthy-Recipes-June.pdf'),
  ('diet',    'Research',       'PCOS-Nutrition-Guidelines.pdf'),
  ('trainer', 'Workout Cards',  'Knee-Safe-Strength-Card.pdf'),
  ('trainer', 'Programmes',     '8-Week-Strength-Block.xlsx'),
  ('coach',   'Coaching',       'Habit-Tracker-Template.xlsx'),
  ('coach',   'Coaching',       'Sleep-Hygiene-Handout.pdf'),
  ('doctor',  'Medical',        'Prescription-Template.docx'),
  ('doctor',  'Medical',        'Lab-Referral-Form.pdf'),
  ('all',     'MDT',            'MDT-Meeting-Notes-June.docx')
) as v(role, folder, name)
where not exists (select 1 from resource_files);
