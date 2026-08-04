-- ============================================================================
-- Cureocity — deliver prescriptions & lab requisitions to the client portal.
-- Run after 0120.
--
-- `shared_at` is the delivery gate. Until now the portal filtered on it in the
-- query only, while RLS let a client read *any* of their prescriptions — so a
-- signed-but-unshared prescription (still the doctor's working copy) was
-- reachable by id at /rx/<id>/print. The policies below make the database
-- enforce what the app already intended, which is how consultations already
-- work (`client_consults ... and shared = true`, 0006).
-- ============================================================================

-- Prescriptions — own, and only once delivered.
drop policy if exists rx_client_read on prescriptions;
create policy rx_client_read on prescriptions for select
  using (client_id = my_client_id() and shared_at is not null);

-- Their line items follow the parent.
drop policy if exists rxi_client_read on prescription_items;
create policy rxi_client_read on prescription_items for select
  using (exists (
    select 1 from prescriptions p
     where p.id = prescription_items.prescription_id
       and p.client_id = my_client_id()
       and p.shared_at is not null
  ));

-- Lab / imaging orders — same rule.
drop policy if exists orders_client_read on orders;
create policy orders_client_read on orders for select
  using (client_id = my_client_id() and shared_at is not null);

-- Staff policies are untouched: rx_read / orders_read (0068) still scope
-- reading to Administrators, Super Admins and Doctors.
