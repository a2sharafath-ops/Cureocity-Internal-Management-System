-- ============================================================================
-- Cureocity — lead ownership. Run after 0082.
--
-- Today `leads.fde` is free text behind a plain <input>: not a foreign key, not
-- validated, and never set automatically. A lead created with the box left
-- blank has no owner at all, and 223 leads name someone who has no staff row.
--
-- That makes every downstream alert imprecise. The nightly callback sweep
-- (lib/cron/lead-followups.ts) reads the owner name purely to interpolate it
-- into a notification body, then broadcasts to the whole Front Desk role,
-- because there is no id to target.
--
-- This adds a real owner. `fde` is deliberately left in place and untouched —
-- it is the historical record of who first handled the lead, which is not
-- always who owns it now, and 998 rows depend on it.
-- ============================================================================

begin;

alter table leads add column if not exists owner_id          text references staff(id);
alter table leads add column if not exists owner_assigned_at timestamptz;
alter table leads add column if not exists owner_method      text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_owner_method_chk') then
    alter table leads add constraint leads_owner_method_chk
      check (owner_method is null or owner_method in ('backfill','manual','creator','rule'));
  end if;
end $$;

comment on column leads.owner_id is
  'Staff member responsible for this lead now. Distinct from fde, which records '
  'who originally handled it. Alerts target this.';
comment on column leads.owner_method is
  'How ownership was decided: backfill (migrated from fde) | manual (chosen in '
  'the UI) | creator (fell back to whoever created the lead) | rule (routing '
  'engine, not yet built).';

create index if not exists leads_owner_idx on leads (owner_id) where owner_id is not null;

-- ---- backfill from fde -----------------------------------------------------
-- Exact name match first. 775 of 999 leads resolve this way.
update leads l
   set owner_id = s.id, owner_assigned_at = now(), owner_method = 'backfill'
  from staff s
 where l.owner_id is null
   and btrim(l.fde) = s.name;

-- Then the one known spelling variant. 0076 normalised most of these, but the
-- alias map in app/(app)/leads/page.tsx still carries "Tamanna" -> Thamanna
-- Nazer, so honour it here rather than leaving those rows unowned.
update leads l
   set owner_id = s.id, owner_assigned_at = now(), owner_method = 'backfill'
  from staff s
 where l.owner_id is null
   and lower(btrim(l.fde)) = 'tamanna'
   and s.name = 'Thamanna Nazer';

-- ---- Rohin's 223 leads -----------------------------------------------------
-- "Rohin" has no staff row (pruned in 0069) and is not returning. Per the
-- product decision, these are split evenly between the two current Front Desk
-- staff rather than parked unowned — an unowned lead is one nobody chases.
--
-- The split is by row_number over a stable ordering, so this is deterministic
-- and produces the same result if re-run against the same data.
with numbered as (
  select id, row_number() over (order by id) as rn
    from leads
   where owner_id is null
     and lower(btrim(coalesce(fde, ''))) = 'rohin'
)
update leads l
   set owner_id          = case when n.rn % 2 = 1 then 's1' else 'thamanna-nazer' end,
       owner_assigned_at = now(),
       owner_method      = 'backfill'
  from numbered n
 where l.id = n.id;

commit;

-- Verify:
--   select owner_id, count(*) from leads group by owner_id order by 2 desc;
--   select count(*) from leads where owner_id is null;   -- expect 1 (the blank fde)
--   select fde, owner_id, count(*) from leads group by 1,2 order by 3 desc;
