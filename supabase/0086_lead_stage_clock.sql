-- ============================================================================
-- Cureocity — when did this lead last move? Run after 0085.
--
-- Nothing has ever recorded stage transitions, so "stuck in Discovery for three
-- weeks" has been uncomputable. 519 of 847 open leads sit in Discovery right
-- now and there is no way to tell which arrived yesterday and which have been
-- there since last year.
--
-- WHY A TRIGGER RATHER THAN APPLICATION CODE
--
-- `leads.stage` is written from at least four places in lib/actions.ts:
-- updateLeadStage, two conversion paths that force '5-Close', and the
-- experience-booking path that forces '4-Visit/Trial'. Setting the timestamp in
-- each means the next new write path silently breaks the clock — and a clock
-- that is wrong for some rows is worse than no clock, because you cannot tell
-- which rows to trust. The trigger fires on the column regardless of caller.
--
-- BACKFILL: DELIBERATELY NONE
--
-- Existing rows keep stage_changed_at NULL. Setting it to created_at would
-- claim a lead moved to Discovery on the day it arrived, which is a fiction —
-- and one that would immediately flag hundreds of leads as stagnant on the
-- evidence of invented data. NULL honestly means "we never saw this move", and
-- the stagnation sweep treats NULL as unknown rather than as stuck.
-- ============================================================================

begin;

alter table leads add column if not exists stage_changed_at timestamptz;

comment on column leads.stage_changed_at is
  'When stage last changed. NULL means no transition has been observed since '
  '0086 — the lead has not moved, so its time-in-stage is unknown rather than '
  'zero. Maintained by trigger, not by application code.';

create index if not exists leads_stage_changed_idx
  on leads (stage_changed_at) where stage_changed_at is not null;

-- ---- the clock -------------------------------------------------------------
create or replace function set_lead_stage_changed() returns trigger as $$
begin
  -- Only a genuine change counts. Re-saving a lead from the edit form writes
  -- the same stage back; that is not movement and must not reset the clock,
  -- or an untouched lead could be kept looking fresh forever by editing it.
  if tg_op = 'INSERT' then
    new.stage_changed_at := now();
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists leads_stage_clock on leads;
create trigger leads_stage_clock
  before insert or update of stage on leads
  for each row execute function set_lead_stage_changed();

commit;

-- Verify:
--   select count(*) from leads where stage_changed_at is not null;  -- 0 at first
--   update leads set stage = stage where id = (select id from leads limit 1);
--     -- ^ should still be 0: same value is not a change
--   select stage, count(*), min(stage_changed_at) from leads group by stage;
