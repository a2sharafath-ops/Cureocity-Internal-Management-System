-- ============================================================================
-- Cureocity — marketing campaign attribution on leads. Run after 0043.
-- (Source column already exists.)
-- ============================================================================

alter table leads add column if not exists campaign text;
