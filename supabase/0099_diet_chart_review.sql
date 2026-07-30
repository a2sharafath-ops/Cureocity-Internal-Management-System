-- ============================================================================
-- Cureocity — diet charts now go through Medical-Director review before they can
-- be published. Flow: Draft → In review → Approved → Published (or the reviewer
-- sends it back to Draft with a note). Run after 0098.
-- status column already exists (text); these add the review trail.
-- ============================================================================

alter table diet_charts add column if not exists review_note  text;
alter table diet_charts add column if not exists reviewed_by  text;
alter table diet_charts add column if not exists reviewed_at  timestamptz;
alter table diet_charts add column if not exists submitted_at timestamptz;
