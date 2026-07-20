-- ============================================================================
-- Cureocity — clinical Whiteboard. Run after 0072.
--
-- The daily multi-disciplinary meeting. BluePrint is the signed-off baseline
-- document, produced once from blood work + 3 consultations. The whiteboard
-- reads the SAME dataset but runs daily: the team looks at a client, adjusts
-- the working interpretation, and records what to do next.
--
-- Deliberately separate from `blueprints`: that document stays immutable once
-- signed off, so you keep the history of what was actually agreed. The
-- whiteboard layers dated insights on top of it.
-- ============================================================================

-- One row per meeting day (per branch, so two centres can meet separately).
create table if not exists whiteboard_sessions (
  id         uuid primary key default gen_random_uuid(),
  date       date not null default current_date,
  branch     text,
  status     text not null default 'open' check (status in ('open', 'closed')),
  facilitator text,
  notes      text,
  created_at timestamptz not null default now(),
  closed_at  timestamptz,
  unique (date, branch)
);

-- A client brought to the board on a given day.
create table if not exists whiteboard_cards (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references whiteboard_sessions(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  -- why they're on the board: auto-flagged by the system, or added by hand
  reason     text,
  origin     text not null default 'manual' check (origin in ('manual', 'flagged')),
  status     text not null default 'pending' check (status in ('pending', 'discussed', 'deferred')),
  -- the team's working adjustment to the BluePrint interpretation. Shape mirrors
  -- blueprints.scores so the two can be diffed: { "<scoreKey>": {"score": n, "note": "..."} }
  score_tweaks jsonb not null default '{}',
  headline   text,             -- the one-line takeaway from the discussion
  position   int not null default 0,
  added_by   text,
  created_at timestamptz not null default now()
);
create index if not exists whiteboard_cards_session_idx on whiteboard_cards (session_id);
create index if not exists whiteboard_cards_client_idx  on whiteboard_cards (client_id);

-- What the team said and decided. Multiple per card, one per contributor.
create table if not exists whiteboard_notes (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references whiteboard_cards(id) on delete cascade,
  discipline text,             -- doctor | dietitian | trainer | coach | psych
  kind       text not null default 'insight' check (kind in ('insight', 'action', 'concern')),
  body       text not null,
  -- actions can be owned and chased
  owner_id   text references staff(id) on delete set null,
  due_date   date,
  done       boolean not null default false,
  author     text,
  created_at timestamptz not null default now()
);
create index if not exists whiteboard_notes_card_idx on whiteboard_notes (card_id);

-- ---------------------------------------------------------------------------
-- RLS: the whiteboard is a shared clinical space — every clinician reads the
-- whole board (that's the point of a team meeting) and may contribute. Only
-- admins and managers open or close a day.
alter table whiteboard_sessions enable row level security;
alter table whiteboard_cards    enable row level security;
alter table whiteboard_notes    enable row level security;

drop policy if exists wb_sessions_read  on whiteboard_sessions;
drop policy if exists wb_sessions_write on whiteboard_sessions;
drop policy if exists wb_cards_read     on whiteboard_cards;
drop policy if exists wb_cards_write    on whiteboard_cards;
drop policy if exists wb_notes_read     on whiteboard_notes;
drop policy if exists wb_notes_write    on whiteboard_notes;
drop policy if exists wb_notes_own      on whiteboard_notes;

create policy wb_sessions_read  on whiteboard_sessions for select using (is_staff());
create policy wb_sessions_write on whiteboard_sessions for all
  using (is_admin() or my_role() = 'Manager') with check (is_admin() or my_role() = 'Manager');

create policy wb_cards_read  on whiteboard_cards for select using (is_staff());
create policy wb_cards_write on whiteboard_cards for all using (is_staff()) with check (is_staff());

create policy wb_notes_read  on whiteboard_notes for select using (is_staff());
create policy wb_notes_write on whiteboard_notes for all using (is_staff()) with check (is_staff());
