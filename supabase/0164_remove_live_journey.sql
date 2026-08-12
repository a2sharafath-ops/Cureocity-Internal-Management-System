-- Remove the retired Live Journey board and its event history.
--
-- The Health Coach intake, assessments, referrals, alerts, follow-ups and
-- care-team assignments are separate features and are intentionally retained.

begin;

-- Remove obsolete bell items before their destination disappears.
delete from public.notifications where href = '/journey';

-- Events depend on journeys, so drop the child table first.
drop table if exists public.journey_events;
drop table if exists public.journeys;

commit;
