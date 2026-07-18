-- ============================================================================
-- Cureocity — split "Health Professional" into five discipline roles.
-- Run after 0064.
--
-- New login roles: Doctor, Dietitian, Fitness Trainer, Health Coach, Psychologist.
-- staff.designation already carries each provider's discipline, so we use it to
-- migrate existing rows. Any remaining 'Health Professional' profile falls back
-- to Doctor so no clinician is locked out (reassign in Users & Roles).
-- ============================================================================

-- Care-provider directory: point role at the discipline designation.
update staff
set role = designation
where designation in ('Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach', 'Psychologist')
  and role is distinct from designation;

-- Auth profiles: map by matching the staff member's name → their discipline.
update profiles p
set role = s.designation
from staff s
where p.role = 'Health Professional'
  and p.name = s.name
  and s.designation in ('Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach', 'Psychologist');

-- Fallback: any clinician login still on the old role becomes Doctor.
update profiles set role = 'Doctor' where role = 'Health Professional';
