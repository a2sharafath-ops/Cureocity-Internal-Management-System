-- ============================================================================
-- Cureocity — OTP verification store (lead conversion consent). Run after 0044.
-- ============================================================================

create table if not exists verifications (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  code       text not null,
  purpose    text default 'lead_convert',
  expires_at timestamptz not null,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists verifications_phone_idx on verifications (phone, created_at desc);

alter table verifications enable row level security;
drop policy if exists verifications_staff on verifications;
create policy verifications_staff on verifications for all using (is_staff()) with check (is_staff());
