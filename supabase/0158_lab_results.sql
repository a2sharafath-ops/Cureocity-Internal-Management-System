-- Lab results as numbers, not as a PDF somebody has to open.
--
-- WHY THIS EXISTS
--
-- Section 4 of the clinic's brief: "Identify deficiencies from history/lab
-- reports. Include appropriate food sources."
--
-- Today a blood report is an uploaded file with a typed summary beside it, and
-- `blood_requests` records only whether one was asked for and whether it came
-- back. Not one value is stored as a number. So a low ferritin can only reach a
-- diet chart if a person remembers it, carries it across two screens and types
-- it into a free-text box — which is the failure this whole layer exists to
-- remove, sitting in the middle of the one section that is about deficiencies.
--
-- WHAT IT DOES NOT REPLACE
--
-- The uploaded report stays exactly where it is and remains the record. This
-- table holds the handful of markers a dietitian acts on, transcribed from it.
-- A transcription can be wrong in a way a scan cannot, so every row records who
-- entered it and when, and the report itself is always one click away.
--
-- WHY A ROW PER MARKER RATHER THAN A COLUMN PER MARKER
--
-- A column per marker means a migration every time a doctor orders something
-- new, and forty mostly-empty columns within a year. A row per marker also lets
-- the same panel be entered twice on different dates without either overwriting
-- the other, which is the whole point of watching ferritin over six months.
--
-- WHY THE LAB'S OWN RANGE IS STORED
--
-- Reference ranges differ between laboratories, between analysers and between
-- men and women, and a value read against the wrong range is worse than a value
-- read against none. Where the report prints a range it is kept verbatim and
-- used; where it does not, the app falls back to a published range and says so
-- on screen. `low`/`high` are nullable for exactly that reason.

create table if not exists lab_results (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  -- The date on the report, not the date somebody typed it in. A ferritin from
  -- March read as though it were from today is how a resolved deficiency gets
  -- treated twice.
  taken_on    date not null,
  -- A stable key the app can reason about ('ferritin', 'vitamin_d'), so a
  -- rule does not depend on how somebody spelled it.
  marker      text not null,
  -- What the report actually called it, kept because labs disagree:
  -- "25-OH Vitamin D", "Vitamin D (25 Hydroxy)", "VIT D TOTAL".
  label       text,
  value       numeric not null,
  unit        text not null,
  -- The reference range printed on THIS report. Null where it printed none.
  low         numeric,
  high        numeric,
  panel       text,                                  -- BluePrint, Comprehensive…
  notes       text,
  entered_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists lab_results_client_idx on lab_results (client_id, taken_on desc);
create index if not exists lab_results_marker_idx on lab_results (client_id, marker, taken_on desc);

comment on table lab_results is
  'Individual lab values transcribed from an uploaded report. The report remains the record; this is what the app can reason about.';
comment on column lab_results.low is
  'The reference range printed on this report. Null means the report printed none and a published range is used instead — the screen says which.';

alter table lab_results enable row level security;

drop policy if exists lab_results_staff on lab_results;
create policy lab_results_staff on lab_results for all
  using (is_staff()) with check (is_staff());

-- A client may read their own results, the same as their vitals and
-- medications. They are already entitled to the report these came from.
drop policy if exists lab_results_client_read on lab_results;
create policy lab_results_client_read on lab_results for select
  using (client_id = my_client_id());

do $$ begin
  execute 'alter publication supabase_realtime add table lab_results';
exception when others then null; end $$;

-- Proof on screen.
select count(*) as lab_results_rows from lab_results;
