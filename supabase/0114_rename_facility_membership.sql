-- Rename "Facility Membership" → "Membership" everywhere it appears as text.
--
-- The word "Facility" added nothing for staff or clients — a membership is a
-- membership. Package IDs (fm4 / fm12 / fm24 / fm48), the `is_facility` flag and
-- the `membership` category are all UNCHANGED: this is a label-only rename, so
-- every membership rule, prerequisite check and renewal path keeps working.
--
-- Safe to re-run (idempotent): replace() on rows that still contain the old
-- string is a no-op once they've been renamed.

begin;

-- 1. The catalogue itself — "Facility Membership — 4 Weeks" → "Membership — 4 Weeks"
update packages
   set name = replace(name, 'Facility Membership', 'Membership')
 where name like '%Facility Membership%';

-- 2. Denormalised package names copied onto each client's held packages.
update client_packages
   set package_name = replace(package_name, 'Facility Membership', 'Membership')
 where package_name like '%Facility Membership%';

-- 3. Invoice line descriptions (historical invoices keep their amounts and
--    numbers; only the wording changes, so a reprint reads consistently).
update invoices
   set description = replace(description, 'Facility Membership', 'Membership')
 where description like '%Facility Membership%';

-- 4. Any service catalogue rows that mention it (none expected, harmless if so).
update services
   set name = replace(name, 'Facility Membership', 'Membership')
 where name like '%Facility Membership%';

commit;

-- Verify — every one of these should return 0 rows after the run:
--   select id, name         from packages        where name         like '%Facility Membership%';
--   select id, package_name from client_packages where package_name like '%Facility Membership%';
--   select id, description  from invoices        where description  like '%Facility Membership%';
--   select id, name         from services        where name         like '%Facility Membership%';
