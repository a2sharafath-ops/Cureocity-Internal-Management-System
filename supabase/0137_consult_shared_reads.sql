-- ============================================================================
-- Cureocity — consultations become shared across the clinical team.
-- Run after 0068 (which set the original per-discipline read hierarchy).
--
-- WHY
--
-- 0068 gave nutrition and training away freely but kept the doctor's and the
-- coach's consultations to their own author. In a single-visit assessment that
-- is the wrong way round: the trainer building a programme cannot read what the
-- doctor found, and the coach writing the closing brief cannot read either of
-- the assessments they are summarising. The client ends up repeating their
-- history to each professional in turn, and a finding that should shape the
-- programme stays in one workspace.
--
-- So every consultation kind is now readable by the five people who actually
-- deliver the care: Doctor, Medical Director, Fitness Trainer, Dietitian and
-- Health Coach. Admins and managers keep the access they had.
--
-- PSYCHOLOGY IS THE EXCEPTION, deliberately.
--
-- Counselling notes are held to a different standard from a fitness assessment;
-- a client tells a psychologist things they have not agreed to share with the
-- person who spots them on a bench press. Psychology consultations therefore
-- keep the 0068 rule — the psychologist, the doctor, and admins.
--
-- WHAT THIS DOES NOT CHANGE
--
-- Only consultations. The doctor-only tables from 0068 — problems, allergies,
-- medications, vitals, encounters, prescriptions and orders — are untouched.
-- Widening a summary so the team can read the finding is a different decision
-- from opening the medical record itself, and only the first was asked for.
-- ============================================================================

-- Which roles deliver care and therefore share the picture. Kept as its own
-- function so the list has one home: the read policy, and anything added later,
-- must not drift apart.
create or replace function is_care_team_role()
returns boolean language sql security definer stable set search_path = public as $$
  select my_role() in (
    'Doctor', 'Medical Director', 'Fitness Trainer', 'Dietitian', 'Health Coach'
  )
$$;

-- Consultation kind → who may read it.
--
-- Psychologist falls through to the 0068 test (own discipline, doctor, admin).
-- Everything else is open to the care team. An unrecognised kind is treated as
-- restricted rather than shared: a new discipline added later must be let in on
-- purpose, not by default.
create or replace function can_read_consult_kind(k text)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when k = 'Psychologist' then can_read_ws('psych')
    when k in ('Doctor', 'Diet', 'Trainer', 'Coach')
      then is_admin() or is_care_team_role()
    else is_admin() or my_role() = 'Doctor'
  end
$$;

-- The policy itself is unchanged in shape — it already delegates to the
-- function above — but recreate it so the intent is visible in one migration.
drop policy if exists consultations_read on consultations;
create policy consultations_read on consultations
  for select using (can_read_consult_kind(kind));

-- ---- check afterwards ----
--   select kind, count(*) from consultations group by kind;
--   -- as a Fitness Trainer, this should now return the doctor's rows:
--   select kind, count(*) from consultations where kind = 'Doctor';
--   -- and this should still return nothing:
--   select kind, count(*) from consultations where kind = 'Psychologist';
