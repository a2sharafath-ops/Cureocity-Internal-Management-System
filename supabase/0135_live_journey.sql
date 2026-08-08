-- ============================================================================
-- Cureocity — the Live Journey (D0 concierge board). Run after 0134.
--
-- The SOP "Core Assessment Journey" makes the Health Coach the single point of
-- contact who walks a walk-in through Fitness -> Medical -> Diet on the same
-- visit, returning within three minutes at every handover. None of that lived
-- in the app: the choreography happened over Teams chat, so nobody could see
-- who was mid-journey, who was waiting, or whether the three-minute standard
-- was being met.
--
-- Two tables. `journeys` is one row per walk-in visit for the day: who they are
-- (a registered client, or just a name + phone for a first-time walk-in), what
-- they came for, and which stage they are in right now. `journey_events` is the
-- append-only log of every stage entry and every "session ending" ping the
-- professionals send the coach. The board reads the row for the live picture;
-- the KPIs (average transition wait, coach-present %, unattended > 3 min) are
-- derived purely from the stage_enter events, so the numbers are reproducible
-- and never drift from a cached counter.
--
-- Staff-only, like the rest of the clinical floor: is_staff() gates both tables
-- (RLS 0006). Clients never see the journey board.
--
-- Deliberately NOT here: this is the PRE-membership visit-day flow. It does not
-- replace the daily MDT whiteboard (0073, post-membership review) or the
-- per-package lifecycle checklist (lib/journey.ts). It sits before both.
-- ============================================================================

-- One row per walk-in visit --------------------------------------------------
create table if not exists journeys (
  id               uuid primary key default gen_random_uuid(),
  -- A registered client if we already know them; otherwise the walk-in's name
  -- and phone captured at the desk (they may not be in `clients` yet).
  client_id        uuid references clients(id) on delete set null,
  walk_in_name     text,
  walk_in_phone    text,
  goal             text,
  source           text default 'Walk-in',
  concerns         text,
  -- The Health Coach who owns this journey (single point of contact).
  -- staff.id is text in this schema (matches appointments.provider_id).
  coach_id         text references staff(id) on delete set null,
  branch           text,
  stage            text not null default 'front_desk'
                   check (stage in (
                     'front_desk','await_coach','briefing','fitness',
                     'transition_med','medical','transition_diet','diet',
                     'review','done'
                   )),
  -- When the client entered the CURRENT stage — drives the live timer and the
  -- three-minute standard on the waiting stages.
  stage_entered_at timestamptz not null default now(),
  status           text not null default 'active'
                   check (status in ('active','done','cancelled')),
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists journeys_status_idx on journeys (status, stage);
create index if not exists journeys_created_idx on journeys (created_at);

-- Append-only event log ------------------------------------------------------
create table if not exists journey_events (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references journeys(id) on delete cascade,
  kind        text not null
              check (kind in ('stage_enter','notify_coach','handover','cancel','note')),
  stage       text,
  at          timestamptz not null default now(),
  by_name     text,
  meta        jsonb
);
create index if not exists journey_events_journey_idx on journey_events (journey_id, at);

-- RLS: staff-only, both tables ----------------------------------------------
alter table journeys enable row level security;
drop policy if exists journeys_staff on journeys;
create policy journeys_staff on journeys for all
  using (is_staff()) with check (is_staff());

alter table journey_events enable row level security;
drop policy if exists journey_events_staff on journey_events;
create policy journey_events_staff on journey_events for all
  using (is_staff()) with check (is_staff());

-- Live updates: the board refreshes when either table changes.
do $$ begin execute 'alter publication supabase_realtime add table journeys'; exception when others then null; end $$;
do $$ begin execute 'alter publication supabase_realtime add table journey_events'; exception when others then null; end $$;

-- ---- check afterwards ----
--   select stage, count(*) from journeys where status = 'active' group by stage;
--   select kind, count(*) from journey_events group by kind order by 2 desc;
