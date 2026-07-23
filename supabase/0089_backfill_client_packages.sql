-- ============================================================================
-- Cureocity — backfill client_packages from the legacy clients.package_id.
-- Run after 0088 (SQL Editor).
--
-- Historically a client held ONE package, stored as `clients.package_id`. The
-- newer `client_packages` table (0047) records one row per package with real
-- start/end dates and status, and everything that reasons about memberships
-- (the "active membership" badge, the PT/Comprehensive prerequisite) reads that
-- table. Clients created before 0047 — or converted without a client_packages
-- row — therefore looked like they had "no active membership" despite holding a
-- facility membership on the legacy field.
--
-- This copies each client's legacy package into client_packages, mirroring the
-- category/validity/status rules the app uses (lib/packages.ts packageCategory,
-- end_date = start + packages.validity days). Idempotent: skips any client that
-- already has a client_packages row for that same package, so re-running is safe.
-- ============================================================================

insert into client_packages
  (client_id, package_id, package_name, category, start_date, end_date, price, status, created_by)
select
  c.id,
  c.package_id,
  p.name,
  case
    when p.is_facility            then 'membership'
    when c.package_id like 'pt%'  then 'training'
    when c.package_id like 'comp%' then 'comprehensive'
    when c.package_id = 'bp1'     then 'blueprint'
    else 'other'
  end                                                            as category,
  coalesce(c.joined, current_date)                              as start_date,
  case when p.validity > 0
       then (coalesce(c.joined, current_date) + (p.validity || ' days')::interval)::date
       else null end                                            as end_date,
  p.price,
  case
    when p.validity > 0
     and (coalesce(c.joined, current_date) + (p.validity || ' days')::interval)::date < current_date
    then 'expired'
    else 'active'
  end                                                            as status,
  'backfill 0089'
from clients c
join packages p on p.id = c.package_id
where c.package_id is not null
  and not exists (
    select 1 from client_packages cp
    where cp.client_id = c.id and cp.package_id = c.package_id
  );

-- Verify:
--   select category, status, count(*) from client_packages group by 1, 2 order by 1, 2;
--   -- clients with a legacy package but still no client_packages row (should be 0):
--   select count(*) from clients c
--   where c.package_id is not null
--     and not exists (select 1 from client_packages cp where cp.client_id = c.id);
