-- ============================================================================
-- Cureocity — let a client mark their OWN blood report submitted from the portal.
-- Run after 0006 (SQL Editor -> New query -> paste -> Run).
-- ============================================================================

drop policy if exists client_blood_write on blood_requests;
create policy client_blood_write on blood_requests
  for update
  using (client_id = my_client_id())
  with check (client_id = my_client_id());
