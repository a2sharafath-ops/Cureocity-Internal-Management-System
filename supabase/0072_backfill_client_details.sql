-- ============================================================================
-- Cureocity — fill in the two half-empty client records. Run after 0071.
--
-- CUR-003 (Anjoom) and CUR-005 (Shahafar) were created without demographics.
-- The values below are INVENTED placeholder data so the screens have something
-- realistic to render — replace them with the real details when you have them.
-- DOB is DD/MM/YYYY to match how the intake kiosk stores it.
-- ============================================================================

-- 1. Anjoom Korambayil (CUR-003) — demographics.
update clients set
  dob        = '05/11/1991',
  gender     = 'Female',
  email      = 'anjoom.korambayil@gmail.com',
  occupation = 'Teacher',
  height     = 162,
  weight     = 68,
  conditions = 'None',
  goals      = array['Fat loss', 'General fitness'],
  address    = 'Panampilly Nagar, Kochi 682036',
  emergency  = '9846 072300',
  consent_tnc = true,
  consent_waiver = true
where code = 'CUR-003';

-- Anjoom had no package at all, which is why the journey bar was empty. A new
-- client can't start on PT/Comprehensive (membership prerequisite), so this is
-- a facility membership.
update clients set package_id = 'fm12' where code = 'CUR-003' and package_id is null;

insert into client_packages (client_id, package_id, package_name, category, start_date, end_date, price, status, created_by)
select c.id, 'fm12', 'Facility Membership — 12 Weeks', 'membership',
       c.joined, (c.joined + interval '84 days')::date, 15000, 'active', 'migration 0072'
from clients c
where c.code = 'CUR-003'
  and not exists (select 1 from client_packages cp where cp.client_id = c.id and cp.package_id = 'fm12');

-- 2. Shahafar (CUR-005) — demographics. Package (BluePrint) was already set.
update clients set
  phone      = '9847 118820',
  dob        = '19/09/1994',
  gender     = 'Male',
  email      = 'shahafar.k@gmail.com',
  occupation = 'Marketing Executive',
  height     = 176,
  weight     = 79,
  conditions = 'None',
  goals      = array['Health assessment', 'Fat loss'],
  address    = 'Edappally, Kochi 682024',
  emergency  = '9847 118800',
  consent_tnc = true,
  consent_waiver = true
where code = 'CUR-005';

-- 3. Both were missing invoices — the owner dashboard was flagging them as
--    unbilled revenue. Raise them against the next free invoice numbers.
insert into invoices (num, client_id, description, amount, status, issued_date, created_by)
select (select coalesce(max(num), 0) from invoices) + 1,
       c.id, 'Facility Membership — 12 Weeks package', 15000, 'Unpaid', c.joined, 'migration 0072'
from clients c
where c.code = 'CUR-003'
  and not exists (select 1 from invoices i where i.client_id = c.id);

insert into invoices (num, client_id, description, amount, status, issued_date, created_by)
select (select coalesce(max(num), 0) from invoices) + 1,
       c.id, 'BluePrint package', 2624, 'Unpaid', c.joined, 'migration 0072'
from clients c
where c.code = 'CUR-005'
  and not exists (select 1 from invoices i where i.client_id = c.id);

-- 4. Sahal's session counter disagreed with the actual completed rows.
update clients c set used = (
  select count(*) from sessions s where s.client_id = c.id and s.status = 'completed'
)
where exists (select 1 from sessions s where s.client_id = c.id)
  and c.used <> (select count(*) from sessions s where s.client_id = c.id and s.status = 'completed');
