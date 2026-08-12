-- ============================================================================
-- Cureocity — Health Coach 360 phase 7 privacy adjustment.
-- Run after 0170.
--
-- Practice insights remain visible to each Health Coach. Human audit ratings
-- are management/clinical-governance records and are restricted to
-- Administrator, Manager, Super Admin and Medical Director through is_admin().
-- ============================================================================

begin;

drop policy if exists coach_quality_reviews_read on coach_quality_reviews;
create policy coach_quality_reviews_read on coach_quality_reviews for select
  using (is_admin());

-- Earlier Phase-7 code briefly generated score-bearing notifications for the
-- reviewed Coach. Remove only those system-generated notices so an old alert
-- cannot bypass the new restricted review screen.
delete from notifications
where title like 'Session quality review — %'
  and link_kind = 'client';

commit;
