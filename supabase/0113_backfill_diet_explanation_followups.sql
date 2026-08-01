-- Cureocity — backfill: close Day-2 diet chart explanation follow-ups that were
-- already delivered as an appointment but left open. Run once in the SQL editor.
--
-- Cause: the explanation is a follow-up, but it can be booked as a "Diet Chart
-- Explanation" appointment straight from the calendar / the coach's Schedule
-- button (bypassing the follow-ups queue that would have closed it). Going
-- forward, createAppointment closes the follow-up on booking; this fixes the
-- rows created before that. Only follow-ups with a real, non-cancelled
-- explanation appointment on file are touched.

update followups f
set stage = 'BOOKED',
    status = 'done',
    done_by = coalesce(f.done_by, 'system (backfill)'),
    done_at = coalesce(f.done_at, now())
where f.day = 2
  and f.label ilike '%explanation%'
  and f.status <> 'done'
  and exists (
    select 1 from appointments a
    where a.client_id = f.client_id
      and a.status <> 'cancelled'
      and a.type ilike '%diet chart explanation%'
  );
