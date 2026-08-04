-- ============================================================================
-- Cureocity — prescription & lab-requisition documents. Run after 0119.
--
-- Two things:
--   1. A public `branding` bucket for the uploaded sheet designs. These are
--      clinic stationery, not patient data, so public read is correct — it also
--      means the print pages render the background without a signed URL.
--   2. Links from a prescription / lab order back to the consultation it came
--      out of, so a requisition can print "the tests advised in this session"
--      rather than one row at a time.
-- ============================================================================

alter table prescriptions add column if not exists consultation_id uuid references consultations(id) on delete set null;
alter table orders        add column if not exists consultation_id uuid references consultations(id) on delete set null;

-- When the sheet was delivered to the client's portal. Prescriptions already
-- had this column (0078) but nothing ever wrote it; orders did not have it.
alter table orders        add column if not exists shared_at timestamptz;

create index if not exists orders_consultation_idx        on orders (consultation_id);
create index if not exists prescriptions_consultation_idx on prescriptions (consultation_id);

-- ---- branding bucket -------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

drop policy if exists branding_read  on storage.objects;
drop policy if exists branding_write on storage.objects;

-- Anyone may read (the sheet design appears on printable documents).
create policy branding_read on storage.objects for select
  using (bucket_id = 'branding');

-- Only Administrators / Super Admins may upload or replace a design.
create policy branding_write on storage.objects for all
  using (bucket_id = 'branding' and my_role() in ('Administrator', 'Super Admin'))
  with check (bucket_id = 'branding' and my_role() in ('Administrator', 'Super Admin'));
