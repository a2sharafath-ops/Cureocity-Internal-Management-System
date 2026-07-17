-- ============================================================================
-- Cureocity — richer follow-up queue (smart scheduler). Adds category / day /
-- mode and a call→link→review→closed pipeline stage. Run after 0054.
-- ============================================================================

alter table followups add column if not exists category      text;
alter table followups add column if not exists day           int;
alter table followups add column if not exists mode          text default 'Offline';   -- Online | Offline
alter table followups add column if not exists stage         text default 'PENDING_CALL'; -- PENDING_CALL | LINK_SENT | PENDING_REVIEW | BOOKED | NO_CONSULT | COMPLETED
alter table followups add column if not exists token         text;
alter table followups add column if not exists summary       text;
alter table followups add column if not exists reminder_sent boolean not null default false;
alter table followups add column if not exists no_answer     boolean not null default false;

-- Backfill category / day / mode from existing labels.
update followups set day = nullif(substring(label from 'Day ([0-9]+)'), '')::int where day is null and label ~ 'Day [0-9]+';
update followups set category = case
    when label ilike '%doctor%'  then 'Doctor Consultation'
    when label ilike '%diet%'    then 'Diet Consultation'
    when kind = 'renewal'        then 'Renewal'
    when day = 2                 then 'Fitness Services'
    when day = 10 or day = 21    then 'Diet Consultation'
    when day = 28                then 'Doctor Consultation'
    else 'Fitness Services' end
  where category is null;
update followups set mode = case when day = 10 or kind = 'renewal' then 'Online' else 'Offline' end where mode is null or mode = 'Offline';

-- Map old status → pipeline stage.
update followups set stage = case
    when status = 'done'    then 'COMPLETED'
    when status = 'skipped' then 'NO_CONSULT'
    else 'PENDING_CALL' end
  where stage is null or stage = 'PENDING_CALL';
