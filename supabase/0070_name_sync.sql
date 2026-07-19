-- ============================================================================
-- Cureocity — one canonical name per person, and link logins to the directory.
-- Run after 0069.
--
-- The staff directory was seeded with short names ('Sini', 'Sharafath') while
-- the logins carry full names ('Sini Antony', 'Sharafath Athimannil'). Anything
-- that matched people by name — role mapping in 0065, branch sync in
-- setUserBranch — silently missed. This makes the full name canonical
-- everywhere and then links profiles.staff_id so future code matches on id.
-- ============================================================================

-- 1. Canonical names in the directory.
update staff set name = 'Sini Antony'          where name = 'Sini';
update staff set name = 'Sharafath Athimannil' where name = 'Sharafath';

-- 2. Sweep every denormalised "who did this" text column in the schema and
--    rewrite the old short names. Dynamic so it covers all ~40 of them
--    (created_by / updated_by / actor_name / approved_by / …) without a
--    hand-maintained list that would rot. Exact matches only — a row reading
--    'Sini' becomes 'Sini Antony'; 'Sinita' is left alone.
do $$
declare
  r record;
  old_new text[][] := array[
    array['Sini', 'Sini Antony'],
    array['Sharafath', 'Sharafath Athimannil']
  ];
  pair text[];
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.data_type = 'text'
      and c.column_name in (
        'created_by','updated_by','actor_name','approved_by','issued_by',
        'handled_by','assigned_to','recorded_by','signed_by','author',
        'performed_by','generated_by','requested_by','resolved_by',
        'reviewed_by','sent_by','posted_by','owner','staff_name','user_name'
      )
      -- staff.name is handled above; profiles.name is already canonical
      and not (c.table_name = 'staff' and c.column_name = 'name')
  loop
    foreach pair slice 1 in array old_new loop
      execute format('update public.%I set %I = %L where %I = %L',
                     r.table_name, r.column_name, pair[2], r.column_name, pair[1]);
    end loop;
  end loop;
end $$;

-- 3. Link each staff login to its directory row, now that the names agree.
update profiles p
set staff_id = s.id
from staff s
where p.staff_id is null
  and p.client_id is null
  and p.role <> 'Client'
  and lower(trim(p.name)) = lower(trim(s.name));

-- 4. One login per directory row (nulls don't collide, so unlinked rows are fine).
create unique index if not exists profiles_staff_id_key on profiles (staff_id)
  where staff_id is not null;

-- 5. Guard rail: a login attached to a client record must carry the Client role,
--    so it can never surface on Users & Roles as staff.
update profiles set role = 'Client' where client_id is not null and role <> 'Client';
