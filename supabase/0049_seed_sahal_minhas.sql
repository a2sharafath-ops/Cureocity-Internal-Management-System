-- ============================================================================
-- Cureocity — seed data. Run after 0047 (client_packages) and 0048.
--   #4  Give Minhas (CUR-002) a valid 1-year membership + record his existing
--       Comprehensive package (so the membership-prerequisite rule is satisfied).
--   #3  Add Sahal K (CUR-003): came from a lead → converted, bought a 1-year
--       membership first, then a PT (Personal Training) package. In the PT
--       package for ~3 weeks (PT started 2026-06-26; today is 2026-07-17).
-- Idempotent-ish: safe to re-run (uses NOT EXISTS guards).
-- ============================================================================

-- ---- #4  Minhas: 1-year membership + his Comprehensive package -------------
insert into client_packages (client_id, package_id, package_name, category, start_date, end_date, price, status, created_by)
select '22222222-2222-2222-2222-222222222222', 'fm48', 'Facility Membership — 48 Weeks', 'membership',
       '2026-06-11', '2027-06-11', 35000, 'active', 'Seed'
where not exists (
  select 1 from client_packages
  where client_id = '22222222-2222-2222-2222-222222222222' and category = 'membership');

insert into client_packages (client_id, package_id, package_name, category, start_date, end_date, price, status, created_by)
select '22222222-2222-2222-2222-222222222222', 'comp12', 'Comprehensive — 12 Weeks', 'comprehensive',
       '2026-06-11', '2026-09-03', 35000, 'active', 'Seed'
where not exists (
  select 1 from client_packages
  where client_id = '22222222-2222-2222-2222-222222222222' and category = 'comprehensive');

-- ---- #3  Sahal K: lead → client, membership (1yr) then PT -------------------
-- lead (converted)
insert into leads (name, phone, source, interest, stage, goals, location, profession)
select 'Sahal K', '9846 220145', 'Referral', 'Personal Training', '5-Close',
       'Muscle gain', 'Kochi', 'Marketing Manager'
where not exists (select 1 from leads where name = 'Sahal K' and phone = '9846 220145');

-- client (PT is the currently-active service package on the record).
-- Code is the next free CUR-nnn (CUR-003 was already taken by another client).
insert into clients (id, code, name, phone, email, package_id, pro_id, used, joined, dob, gender,
                     occupation, height, weight, conditions, goals, address, emergency, branch,
                     verified, consent_tnc, consent_waiver, converted_from)
select '33333333-3333-3333-3333-333333333333',
       'CUR-' || lpad(((select coalesce(max(cast(substring(code from 5) as int)), 0)
                        from clients where code ~ '^CUR-[0-9]+$') + 1)::text, 3, '0'),
       'Sahal K', '9846 220145',
       'sahal.k@gmail.com', 'pt12', 'd1', 9, '2026-06-19', '14/02/1995', 'Male',
       'Marketing Manager', 176, 79, 'None', array['Muscle gain','Strength & flexibility'],
       'Panampilly Nagar, Kochi 682036', '9846 220100', 'Kochi',
       true, true, true, 'CRM lead · Jun 2026'
where not exists (select 1 from clients where id = '33333333-3333-3333-3333-333333333333')
  and not exists (select 1 from clients where name = 'Sahal K' and phone = '9846 220145');

insert into enrollments (client_id, trainer_id, hour)
select '33333333-3333-3333-3333-333333333333', 't0', 9
where not exists (select 1 from enrollments where client_id = '33333333-3333-3333-3333-333333333333');

-- Sahal's 1-year membership (bought first)
insert into client_packages (client_id, package_id, package_name, category, start_date, end_date, price, status, created_by)
select '33333333-3333-3333-3333-333333333333', 'fm48', 'Facility Membership — 48 Weeks', 'membership',
       '2026-06-19', '2027-06-19', 35000, 'active', 'Seed'
where not exists (
  select 1 from client_packages
  where client_id = '33333333-3333-3333-3333-333333333333' and category = 'membership');

-- Sahal's PT package (bought after membership; started 2026-06-26, 12 weeks)
insert into client_packages (client_id, package_id, package_name, category, start_date, end_date, price, status, created_by)
select '33333333-3333-3333-3333-333333333333', 'pt12', 'Personal Training (PT) — 12 Weeks', 'training',
       '2026-06-26', '2026-09-18', 30000, 'active', 'Seed'
where not exists (
  select 1 from client_packages
  where client_id = '33333333-3333-3333-3333-333333333333' and category = 'training');

-- Sahal's PT sessions: 36 sessions on alternate days from 2026-06-26.
-- Mark those on/before today (2026-07-17) as completed (~9 sessions in 3 weeks).
insert into sessions (client_id, trainer_id, seq, date, hour, status)
select '33333333-3333-3333-3333-333333333333', 't0', g,
       (date '2026-06-26' + ((g - 1) * 2)),
       9,
       case when (date '2026-06-26' + ((g - 1) * 2)) <= date '2026-07-17' then 'completed' else 'scheduled' end
from generate_series(1, 36) as g
where not exists (select 1 from sessions where client_id = '33333333-3333-3333-3333-333333333333');

-- invoices for Sahal's two purchases
insert into invoices (num, client_id, description, amount, status, issued_date, created_by)
select (select coalesce(max(num),0) + 1 from invoices), '33333333-3333-3333-3333-333333333333',
       'Facility Membership — 48 Weeks package', 35000, 'Paid', '2026-06-19', 'Seed'
where not exists (select 1 from invoices where client_id = '33333333-3333-3333-3333-333333333333' and description like 'Facility Membership%');

insert into invoices (num, client_id, description, amount, status, issued_date, created_by)
select (select coalesce(max(num),0) + 1 from invoices), '33333333-3333-3333-3333-333333333333',
       'Personal Training (PT) — 12 Weeks package', 30000, 'Paid', '2026-06-26', 'Seed'
where not exists (select 1 from invoices where client_id = '33333333-3333-3333-3333-333333333333' and description like 'Personal Training%');
