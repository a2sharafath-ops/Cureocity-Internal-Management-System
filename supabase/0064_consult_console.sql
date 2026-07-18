-- ============================================================================
-- Cureocity — workspace Phase 6: live consultation console. Run after 0063.
--
-- Stores the in-session intake questionnaire answers on the consultation so the
-- console can reopen a draft and the summary carries the captured intake.
-- ============================================================================

alter table consultations add column if not exists answers     jsonb;   -- [[question, answer], ...]
alter table consultations add column if not exists started_at   timestamptz;
alter table consultations add column if not exists duration_min int;
