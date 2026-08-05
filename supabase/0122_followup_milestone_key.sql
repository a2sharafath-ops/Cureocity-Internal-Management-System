-- ============================================================================
-- Cureocity — follow-ups keyed to care-plan milestones. Run after 0121.
--
-- Until now the follow-ups queue generated its own copy of the Day 2/10/21/28
-- protocol from `clients.joined`, while lib/comprehensive.ts generated the same
-- four touchpoints from the package start date. Two anchors, two due dates, two
-- rows, and closing one never closed the other.
--
-- `milestone_key` makes a follow-up row and a care-plan milestone the same
-- thing. After this migration the generator upserts on (client_id,
-- milestone_key), so a client has exactly one row per touchpoint and one
-- renewal row that updates as the cycle advances.
--
-- Nothing is deleted. Rows that have already been satisfied are closed with a
-- note saying why, so the history stays readable.
-- ============================================================================

alter table followups add column if not exists milestone_key text;

-- ---- 1. label the rows we already have ------------------------------------
update followups set milestone_key = 'explain_2'
 where milestone_key is null and label ilike '%chart explanation%';
update followups set milestone_key = 'diet_10'
 where milestone_key is null and label ilike '%day 10%';
update followups set milestone_key = 'diet_21'
 where milestone_key is null and label ilike '%day 21%';
update followups set milestone_key = 'doctor_28'
 where milestone_key is null and label ilike '%day 28%';
update followups set milestone_key = 'reassess_28'
 where milestone_key is null and label ilike '%reassess%';
update followups set milestone_key = 'renewal'
 where milestone_key is null and kind = 'renewal';

-- ---- 2. collapse the renewal rows that accumulated -------------------------
-- Every renewal cycle minted `Renewal due (<new date>)` and abandoned the
-- previous row, which then sat "to call" for ever. Keep the newest per client.
update followups f
   set status = 'done', stage = 'BOOKED',
       note = coalesce(note || ' · ', '') || 'closed by 0122: superseded by a later renewal cycle',
       done_by = 'migration 0122', done_at = now()
 where f.kind = 'renewal'
   and f.status = 'pending'
   and exists (
     select 1 from followups g
      where g.client_id = f.client_id and g.kind = 'renewal'
        and g.created_at > f.created_at
   );

-- ---- 3. close rows whose visit already happened ---------------------------
-- A follow-up chases a booking. Where the booking exists, the chase is over —
-- these are the rows that were inflating every overdue counter and raising
-- whiteboard alerts for work already done.
update followups f
   set status = 'done', stage = 'BOOKED',
       note = coalesce(note || ' · ', '') || 'closed by 0122: appointment already booked',
       done_by = 'migration 0122', done_at = now()
 where f.status = 'pending'
   and f.milestone_key is not null
   and f.kind = 'onboarding'
   and exists (
     select 1 from appointments a
      where a.client_id = f.client_id
        and a.status <> 'cancelled'
        and a.date >= f.due_date - 7
        and (
          (f.milestone_key = 'explain_2'   and a.type ilike '%chart explanation%') or
          (f.milestone_key in ('diet_10','diet_21') and a.type ilike '%diet%' and a.type not ilike '%explanation%') or
          (f.milestone_key = 'doctor_28'   and a.type ilike '%doctor%') or
          (f.milestone_key = 'reassess_28' and (a.type ilike '%fitness%' or a.type ilike '%training%'))
        )
   );

-- ---- 4. one row per client per touchpoint from here on --------------------
-- Partial, so legacy rows with no key are untouched.
create unique index if not exists followups_client_milestone_uq
  on followups (client_id, milestone_key)
  where milestone_key is not null;

create index if not exists followups_milestone_idx on followups (milestone_key);

-- ---- 5. what changed -------------------------------------------------------
-- Run this after, to see the effect:
--   select coalesce(milestone_key,'(unkeyed)') as key, status, count(*)
--     from followups group by 1,2 order by 1,2;
