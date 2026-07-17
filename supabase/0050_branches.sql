-- ============================================================================
-- Cureocity — branch segregation (Kochi / Calicut). Label + filter model:
-- every client and staff/user carries a branch; lists are filterable by it.
-- Run after 0049.
-- ============================================================================

alter table staff    add column if not exists branch text default 'Kochi';
alter table profiles add column if not exists branch text default 'Kochi';

-- Backfill existing rows to Kochi (our current centre) if null.
update staff    set branch = 'Kochi' where branch is null;
update profiles set branch = 'Kochi' where branch is null;
update clients  set branch = 'Kochi' where branch is null or branch = '';

-- (Reassign specific people to Calicut from the Users & Roles / Clients pages,
--  or with UPDATEs like:  update staff set branch='Calicut' where id='...'; )
