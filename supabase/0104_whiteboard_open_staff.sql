-- ============================================================================
-- Cureocity — whiteboard write access. Run after 0103.
--
-- The whiteboard is the daily multi-disciplinary meeting. It must be usable by
-- exactly: Administrators, Super Admins, Managers, and the five clinical
-- disciplines (Doctor, Dietitian, Fitness Trainer, Health Coach, Psychologist)
-- — the same set the /whiteboard route allows.
--
-- Previously opening/closing the DAY was admin/manager-only, so a clinician
-- (e.g. a Health Coach facilitating the morning board) clicking "Open today's
-- board" had the insert silently rejected by RLS. This lets that intended set
-- open/close the board and record alert answers + daily reviews — while still
-- keeping Front Desk, Finance, HR and other staff out.
--
-- is_admin() already covers Administrator / Super Admin / Manager.
-- ============================================================================

-- open / close the meeting day
drop policy if exists wb_sessions_write on whiteboard_sessions;
create policy wb_sessions_write on whiteboard_sessions for all
  using      (is_admin() or my_role() in ('Doctor','Dietitian','Fitness Trainer','Health Coach','Psychologist'))
  with check (is_admin() or my_role() in ('Doctor','Dietitian','Fitness Trainer','Health Coach','Psychologist'));

-- "why + solution" answers on major alerts
drop policy if exists wb_alert_resp_staff on whiteboard_alert_responses;
create policy wb_alert_resp_staff on whiteboard_alert_responses for all
  using      (is_admin() or my_role() in ('Doctor','Dietitian','Fitness Trainer','Health Coach','Psychologist'))
  with check (is_admin() or my_role() in ('Doctor','Dietitian','Fitness Trainer','Health Coach','Psychologist'));

-- per-client daily "reviewed" markers
drop policy if exists wb_reviews_staff on whiteboard_reviews;
create policy wb_reviews_staff on whiteboard_reviews for all
  using      (is_admin() or my_role() in ('Doctor','Dietitian','Fitness Trainer','Health Coach','Psychologist'))
  with check (is_admin() or my_role() in ('Doctor','Dietitian','Fitness Trainer','Health Coach','Psychologist'));
