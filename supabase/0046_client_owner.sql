-- ============================================================================
-- Cureocity — front-desk owner on clients. Run after 0045.
-- ============================================================================

alter table clients add column if not exists owner text;   -- staff.id of the front-desk owner
