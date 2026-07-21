-- ============================================================================
-- Cureocity — Comprehensive package care protocol. Run after 0077.
--
-- Three structural changes, each with a reason:
--
--  1. blood_requests becomes multi-panel. It was one row per client (client_id
--     was the primary key), so a Comprehensive client who later buys BluePrint
--     — or vice versa — would have their first panel silently overwritten by
--     the second. The panels are genuinely different sets of reports, so they
--     need to coexist.
--
--  2. care_protocols holds one row per client per protocol run: the anchor
--     date, the consolidated-summary gates, and the client-side hold. The hold
--     is the same {since, banked_ms} shape as the package freeze (0075) and
--     the BluePrint hold (0077) — third use, hence the shared lib/sla-clock.
--
--  3. blueprint_sla_events gains a `protocol` column so one ledger serves both
--     protocols. The unique key becomes (client_id, protocol, gate, kind),
--     which is what keeps the nightly sweep from re-notifying forever.
-- ============================================================================

begin;

-- ---- 1. multi-panel blood requests -----------------------------------------
alter table blood_requests add column if not exists panel text not null default 'blueprint';
alter table blood_requests add column if not exists id uuid not null default gen_random_uuid();

comment on column blood_requests.panel is
  'Which set of reports. blueprint | comprehensive. A client may hold one of each.';

-- Swap the primary key from client_id to id, then re-assert one-row-per-panel.
-- Existing rows all default to 'blueprint', which is what they were.
do $$
declare pk text;
begin
  select conname into pk from pg_constraint
   where conrelid = 'blood_requests'::regclass and contype = 'p';
  if pk is not null then execute format('alter table blood_requests drop constraint %I', pk); end if;
end $$;

alter table blood_requests add primary key (id);

create unique index if not exists blood_requests_client_panel_idx
  on blood_requests (client_id, panel);

-- ---- 2. per-client protocol run --------------------------------------------
create table if not exists care_protocols (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  protocol      text not null,              -- 'comprehensive'
  -- Every milestone is counted from here. Package start rather than the join
  -- date, so a client who buys Comprehensive months after joining gets a
  -- protocol anchored to what they actually bought.
  start_date    date not null,
  status        text not null default 'active',   -- active | completed | cancelled

  -- consolidated summary: written, then approved. Both inside 48h of the last
  -- of the three initial appointments completing.
  consolidated_at   timestamptz,
  approved          boolean not null default false,
  approved_at       timestamptz,
  approved_by       text,

  -- client-side hold. Non-null hold_since = clocks paused now; hold_ms banks
  -- time from previously closed holds so the deadline slides rather than
  -- resets.
  hold_since    timestamptz,
  hold_ms       bigint not null default 0,
  hold_note     text,

  created_by    text,
  created_at    timestamptz not null default now(),
  unique (client_id, protocol, start_date)
);

create index if not exists care_protocols_active_idx
  on care_protocols (protocol, status) where status = 'active';

alter table care_protocols enable row level security;
drop policy if exists care_protocols_staff on care_protocols;
create policy care_protocols_staff on care_protocols
  for all using (is_staff()) with check (is_staff());

-- ---- 3. deliverable timestamps ---------------------------------------------
-- Diet chart: the draft deadline is 24h from the initial diet consult. The
-- table already versions per client; what was missing is when a draft first
-- appeared, distinct from when it was published.
alter table diet_charts add column if not exists drafted_at   timestamptz;
alter table diet_charts add column if not exists published_at timestamptz;
update diet_charts set drafted_at = coalesce(drafted_at, created_at) where drafted_at is null;

-- Workout plan: same idea on the assignment row.
alter table client_workouts add column if not exists plan_weeks int;

-- Prescription: signed_date exists but is a date, too coarse for a 24h clock.
alter table prescriptions add column if not exists signed_at   timestamptz;
alter table prescriptions add column if not exists shared_at   timestamptz;
comment on column prescriptions.shared_at is
  'When it became visible to the client in the portal. Null = written but not delivered.';

-- ---- 4. one SLA ledger for both protocols ----------------------------------
alter table blueprint_sla_events add column if not exists protocol text not null default 'blueprint';

do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'blueprint_sla_events'::regclass and contype = 'u';
  if c is not null then execute format('alter table blueprint_sla_events drop constraint %I', c); end if;
end $$;

create unique index if not exists sla_events_once_idx
  on blueprint_sla_events (client_id, protocol, gate, kind);

commit;

-- Verify:
--   select panel, count(*) from blood_requests group by panel;
--   select protocol, status, count(*) from care_protocols group by 1,2;
--   select protocol, kind, count(*) from blueprint_sla_events group by 1,2;
