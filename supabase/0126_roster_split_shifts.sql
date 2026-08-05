-- ============================================================================
-- Cureocity — roster shifts as the clinic actually runs them. Run after 0125.
--
-- Taken from the HR roster workbook (Jan–Aug 2026). Two things it does that the
-- first cut could not:
--
--   1. SPLIT SHIFTS. "6am - 10am , 5pm - 9pm" is one person's day, worked in two
--      blocks with the quiet middle off. It appears 180+ times in the sheet, so
--      it is normal practice, not an exception. One start/end pair could not
--      express it and the roster would have quietly lost the afternoon gap.
--
--   2. The real shift vocabulary — 6–2, 1–9, the split, a 9–5:30 general shift,
--      plus Leave and Public Holiday, which the sheet marks in the same column
--      as the hours because to a reader they answer the same question: is this
--      person in, and when.
-- ============================================================================

-- ---- second block, for split shifts ---------------------------------------
alter table shift_types add column if not exists start_time2 time;
alter table shift_types add column if not exists end_time2   time;
alter table roster      add column if not exists start_time2 time;
alter table roster      add column if not exists end_time2   time;

comment on column roster.start_time2 is
  'Second block of a split shift. Null for a single-block day.';

-- ---- the clinic's actual shifts -------------------------------------------
-- Codes are stable; names and times are editable. Existing M/E/GEN rows are
-- updated in place so any roster already assigned keeps pointing at them.
insert into shift_types (code, name, start_time, end_time, start_time2, end_time2, color, working, active, seq) values
  ('M',     'Morning',        '06:00', '14:00', null,    null,    '#2563eb', true,  true, 1),
  ('E',     'Evening',        '13:00', '21:00', null,    null,    '#7c3aed', true,  true, 2),
  ('SPLIT', 'Split',          '06:00', '10:00', '17:00', '21:00', '#0891b2', true,  true, 3),
  ('GEN',   'General',        '09:00', '17:30', null,    null,    '#16a34a', true,  true, 4),
  ('HALF',  'Half day',       '09:00', '13:00', null,    null,    '#d97706', true,  true, 5),
  ('OFF',   'Week off',        null,    null,   null,    null,    '#94a3b8', false, true, 6),
  ('LV',    'Leave',           null,    null,   null,    null,    '#dc2626', false, true, 7),
  ('PH',    'Public holiday',  null,    null,   null,    null,    '#78716c', false, true, 8)
on conflict (code) do update set
  name        = excluded.name,
  start_time  = excluded.start_time,
  end_time    = excluded.end_time,
  start_time2 = excluded.start_time2,
  end_time2   = excluded.end_time2,
  color       = excluded.color,
  working     = excluded.working,
  active      = excluded.active,
  seq         = excluded.seq;

-- Check afterwards:
--   select code, name, start_time, end_time, start_time2, end_time2 from shift_types order by seq;
