-- ============================================================================
-- Cureocity — stable notification targets. Run after 0094 (Supabase SQL Editor).
-- A notification's `href` is frozen when the row is created, so if we later
-- change where an intent should point (e.g. a "workout plan" reminder), old
-- notifications keep sending people to the wrong place. These two columns store
-- the *intent* instead of a fixed URL; the link is resolved fresh at click-time
-- (see lib/notification-target + openNotification).
--   • link_kind — the semantic target ("workout", "diet-chart", "client", …)
--   • link_ref  — the id it refers to (usually a client id)
-- Rows without link_kind fall back to the stored href, so nothing breaks.
-- ============================================================================

alter table notifications add column if not exists link_kind text;
alter table notifications add column if not exists link_ref  text;
