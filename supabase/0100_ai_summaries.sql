-- ============================================================================
-- Cureocity — persist AI-generated summaries onto the record. InBody summary is
-- saved on the latest measurements row; consultation summary on the latest
-- consultation row. Kept in a dedicated ai_summary column so it never clobbers a
-- clinician's own notes/summary. Run after 0099.
-- ============================================================================

alter table measurements  add column if not exists ai_summary    text;
alter table measurements  add column if not exists ai_summary_at timestamptz;
alter table consultations add column if not exists ai_summary    text;
alter table consultations add column if not exists ai_summary_at timestamptz;
