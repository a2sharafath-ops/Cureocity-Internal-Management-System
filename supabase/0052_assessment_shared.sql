-- ============================================================================
-- Cureocity — assessment visibility (shared with client vs private).
-- Run after 0051.
-- ============================================================================

alter table assessments add column if not exists shared boolean not null default false;
