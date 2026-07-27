-- ============================================================================
-- Cureocity — Workout Planner. Run after 0091 (Supabase SQL Editor).
-- Gives client_workouts the same draft→publish lifecycle as diet_charts, so the
-- trainer gets a per-client workout builder that mirrors the diet chart maker.
--   • status  — 'Draft' while composing, 'Published' once sent to the portal.
--               Existing assigned workouts stay visible (default 'Published').
--   • version — running v-number per client (v1, v2, …), like diet charts.
--   • notes   — free-text coaching note shown to the client.
--   • by_name — who authored the plan (display only).
-- ============================================================================

alter table client_workouts add column if not exists status  text not null default 'Published';
alter table client_workouts add column if not exists version int;
alter table client_workouts add column if not exists notes   text;
alter table client_workouts add column if not exists by_name text;
