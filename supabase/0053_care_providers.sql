-- ============================================================================
-- Cureocity — add a Health Coach + Psychologist so every appointment discipline
-- (Doctor, Dietitian, Fitness Trainer, Health Coach, Psychologist) has a
-- provider in the legend/filter. Run after 0052.
-- ============================================================================

insert into staff (id, name, designation, department, role, is_trainer, color) values
  ('hc1', 'Shahanas Gul',  'Health Coach', 'Health Professional', 'Health Professional', false, '#7c3aed'),
  ('ps1', 'Noufal Hameed', 'Psychologist', 'Health Professional', 'Health Professional', false, '#d97706')
on conflict (id) do nothing;
