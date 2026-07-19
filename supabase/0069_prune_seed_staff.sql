-- ============================================================================
-- Cureocity — prune leftover seed staff from the care-provider directory.
-- Run after 0068.
--
-- The staff table was populated entirely by seed migrations (0001, 0051, 0053).
-- This removes rows that are demonstrably unused, and is written so it CANNOT
-- orphan anything: a row is only deleted when it has zero references across all
-- 13 foreign keys that point at staff(id), and no matching login.
--
-- Protected automatically:
--   • Babith T  — has sessions + enrolments
--   • Sharafath — matches the 'Sharafath Athimannil' login
--   • Sini      — matches the 'Sini Antony' login
-- (name match is prefix-tolerant, since staff names are shorter than login names)
--
-- Expected to be removed: Mohammed Suroor, Afya Sudharshan, Inshad Kalaparambil,
-- Shahanas Gul, Noufal Hameed, Annakutty, Athul AM, Anurudh K Shaiju, Sarath Kumar
-- ============================================================================

-- 1. Release seeded, unassigned trainer slots belonging to trainers with no
--    sessions. (Only slots with no client on them — real bookings are untouched.)
delete from trainer_slots ts
where ts.client_id is null
  and not exists (select 1 from sessions s where s.trainer_id = ts.trainer_id);

-- 2. Delete staff rows that nothing references and nobody logs in as.
delete from staff s
where
  not exists (select 1 from clients            x where x.pro_id      = s.id)
  and not exists (select 1 from enrollments      x where x.trainer_id  = s.id)
  and not exists (select 1 from sessions         x where x.trainer_id  = s.id)
  and not exists (select 1 from profiles         x where x.staff_id    = s.id)
  and not exists (select 1 from classes          x where x.trainer_id  = s.id)
  and not exists (select 1 from appointments     x where x.provider_id = s.id)
  and not exists (select 1 from tasks            x where x.assignee_id = s.id)
  and not exists (select 1 from attendance       x where x.staff_id    = s.id)
  and not exists (select 1 from leaves           x where x.staff_id    = s.id)
  and not exists (select 1 from payroll          x where x.staff_id    = s.id)
  and not exists (select 1 from assessments      x where x.trainer_id  = s.id)
  and not exists (select 1 from recovery_sessions x where x.staff_id   = s.id)
  and not exists (select 1 from trainer_slots    x where x.trainer_id  = s.id)
  -- never delete anyone who has a login (prefix-tolerant name match)
  and not exists (
    select 1 from profiles p
    where p.name is not null and s.name is not null
      and (p.name ilike s.name || '%' or s.name ilike p.name || '%')
  );

-- 3. Tidy: Babith T kept role 'Health Professional' because his designation
--    ("Fitness Manager") wasn't one of the five discipline names in 0065.
update staff set role = 'Fitness Trainer'
where role = 'Health Professional' and is_trainer = true;

-- ---------------------------------------------------------------------------
-- 4. OPTIONAL — add your real team to the care-provider directory.
--    The app's "Add staff" screen creates a LOGIN (profiles), not a directory
--    row. A directory row is what makes someone selectable as an appointment
--    provider / trainer. Use the SAME name as their login so the two link up.
--    Uncomment and edit:
--
-- insert into staff (id, name, designation, department, role, is_trainer, branch, color) values
--   ('dr1',  'Dr. Real Name',      'Doctor',          'Clinical', 'Doctor',          false, 'Kochi', '#dc2626'),
--   ('dt1',  'Dietitian Name',     'Dietitian',       'Clinical', 'Dietitian',       false, 'Kochi', '#2563eb'),
--   ('ft1',  'Trainer Name',       'Fitness Trainer', 'Fitness',  'Fitness Trainer', true,  'Kochi', '#0d9488'),
--   ('hc2',  'Health Coach Name',  'Health Coach',    'Clinical', 'Health Coach',    false, 'Kochi', '#7c3aed'),
--   ('ps2',  'Psychologist Name',  'Psychologist',    'Clinical', 'Psychologist',    false, 'Kochi', '#d97706')
-- on conflict (id) do nothing;
