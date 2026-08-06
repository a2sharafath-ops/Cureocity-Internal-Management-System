-- ============================================================================
-- Cureocity — the Medical Director role. Run after 0129.
--
-- A clinical lead over all five disciplines: they supervise the doctor, the
-- dietitian, the trainer, the coach and the psychologist, they carry a
-- doctor's own caseload, and they are the one person who signs off a diet
-- chart, diet plan or dietary assessment before a client ever sees it.
--
-- Only ONE function changes. Every discipline policy written in 0067 and after
-- is of the form `is_admin() or my_role() = '<discipline>'`, so widening
-- is_admin() grants the director write access across all of them at once —
-- consultations, medical records, prescriptions, orders, diet charts, workout
-- plans, the care team (0071) and the whiteboard (0073).
--
-- What it deliberately does NOT touch:
--   • is_staff() (0006) is `role <> 'Client'`, so the director already counts
--     as staff — no change needed, and no chance of the app treating the
--     clinic's clinical lead as a client;
--   • 0124's HR and payroll policies name their roles explicitly and the
--     director is not among them. Clinical oversight, not commercial: no
--     billing, invoices, POS, finance sheets, comp-off or roster.
--
-- profiles.role is free text with no check constraint, so the value needs no
-- migration of its own — assigning it in Users & Roles is enough.
-- ============================================================================

create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    my_role() in ('Administrator', 'Super Admin', 'Manager', 'Medical Director'),
    false
  )
$$;

comment on function is_admin() is
  'Cross-discipline write access. Administrator / Super Admin / Manager for '
  'operational reasons, Medical Director for clinical supervision. NOT a money '
  'permission — billing and payroll gates name their roles explicitly.';

-- ---- check afterwards -------------------------------------------------------
--   -- who currently holds the role (there must be at least one, or no diet
--   -- chart, plan or assessment can be approved by anyone):
--   select id, name, email, role from profiles where role = 'Medical Director';
--
--   -- anything already waiting on that approval:
--   select 'plan'   as doc, count(*) from diet_plans       where status = 'in_review'
--   union all
--   select 'chart',        count(*) from diet_charts       where status = 'In review'
--   union all
--   select 'assess',       count(*) from diet_assessments  where status = 'in_review';
