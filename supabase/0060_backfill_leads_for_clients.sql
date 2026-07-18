-- ============================================================================
-- Cureocity — backfill CRM & Leads for existing clients. Run after 0059.
--
-- Every client must have originated as a lead. Historic/seeded clients carry a
-- free-text `converted_from` note (e.g. 'Walk-in · May 2026') rather than a real
-- lead row, so they never appear in CRM & Leads. This migration creates a
-- closed ('5-Close') lead for every client that isn't already linked to one and
-- repoints the client's `converted_from` at that new lead's UUID.
--
-- Idempotent: once a client points at a real lead it is skipped on re-run.
-- ============================================================================

do $$
declare base int;
begin
  select coalesce(max(num), 0) into base from leads;

  with missing as (
    select c.id            as client_id,
           c.name,
           c.phone,
           c.occupation,
           c.goals,
           c.branch,
           c.converted_from,
           coalesce(c.joined::timestamptz, c.created_at) as created_at,
           row_number() over (order by c.created_at, c.code, c.id) as rn
    from clients c
    -- no existing lead whose id matches converted_from (covers NULL + free text)
    where not exists (
      select 1 from leads l where l.id::text = c.converted_from
    )
  ),
  ins as (
    insert into leads (num, name, phone, source, profession, goals, location, stage, notes, created_at)
    select base + m.rn,
           m.name,
           m.phone,
           coalesce(nullif(trim(split_part(m.converted_from, '·', 1)), ''), 'Direct'),
           m.occupation,
           nullif(array_to_string(m.goals, ', '), ''),
           m.branch,
           '5-Close',
           'Backfilled to CRM from existing client'
             || coalesce(' — original note: ' || m.converted_from, ''),
           m.created_at
    from missing m
    returning id, num
  )
  update clients c
  set converted_from = ins.id::text
  from ins
  join missing m on m.rn = (ins.num - base)
  where c.id = m.client_id;
end $$;
