-- ============================================================================
-- Cureocity — initial consultations are due on day 0. Run after 0124.
--
-- Every FOLLOW-UP service already carried a `day_offset` (chart explanation
-- day 2, diet follow-ups 10 and 21, reassessment 21, doctor review 28). The
-- three INITIAL services were left null, so the "Book initial doctor
-- consultation" items on the client card and the attention queue were the only
-- outstanding work in the system with no due date — you could not tell a
-- package sold this morning from one sold three weeks ago.
--
-- Day 0 = the day the package starts. The deadline lives in the services
-- catalogue, not in code, so it stays yours to change in Services → Day offset.
-- ============================================================================

update services set day_offset = 0
 where day_offset is null
   and name in (
     'Initial Doctor Consultation',
     'Initial Diet Consultation',
     'Initial Fitness Consultation'
   );

-- Check afterwards — expect three rows at day 0:
--   select name, category, day_offset from services order by day_offset nulls last, category;
--
-- Deliberately NOT set: "12 Sessions Strength". The strength block is booked as
-- a run of sessions rather than a single appointment, and the client card has
-- its own "Schedule sessions" flow for it. Give it an offset only if you want
-- it chased on a date like the consultations.
