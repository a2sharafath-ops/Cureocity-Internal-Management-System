-- ============================================================================
-- Cureocity — a reason attached to every send-back. Run after 0130.
--
-- The diet CHART has carried `review_note` since it was built: the reviewer
-- types why they're sending it back, the dietitian gets it in a notification,
-- and the note sits on the row until the next submission. The diet PLAN and the
-- ASSESSMENT SUMMARY — the two newer, richer documents — never got the same
-- column, so `reviewDietPlan` and `reviewDietAssessment` flipped a status to
-- 'draft' and stopped: no reason recorded, and no notification to the person
-- who wrote it. The dietitian's document simply reappeared as a draft and they
-- were left to guess what was wrong with it.
--
-- That was survivable while approval was an admin formality. Now that sign-off
-- is a named clinical decision by the Medical Director (0130), the reason IS
-- the point — it is what makes the review a conversation rather than a bounce.
-- ============================================================================

alter table diet_plans       add column if not exists review_note text;
alter table diet_assessments add column if not exists review_note text;

comment on column diet_plans.review_note is
  'Why the Medical Director sent this plan back. Cleared on approval.';
comment on column diet_assessments.review_note is
  'Why the Medical Director sent this summary back. Cleared on approval.';

-- ---- check afterwards -------------------------------------------------------
--   select id, status, reviewed_by, review_note
--     from diet_plans where review_note is not null order by reviewed_at desc;
