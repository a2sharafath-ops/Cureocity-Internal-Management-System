-- ============================================================================
-- Cureocity — store the raw questionnaire answers behind a coach assessment.
-- Run after 0110. `detail` holds the per-item responses + any sub-scores
-- (e.g. DAST-10 alongside AUDIT-C) so a score is auditable and re-openable.
-- ============================================================================

alter table coach_assessments add column if not exists detail jsonb;
