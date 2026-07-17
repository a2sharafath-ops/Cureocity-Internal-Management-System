-- ============================================================================
-- Cureocity — tablet self-registration submissions. The kiosk collects the full
-- client profile; the front desk reviews and adds the client (with OTP). Run
-- after 0053.
-- ============================================================================

create table if not exists tablet_submissions (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text,
  phone       text,
  email       text,
  dob         text,
  gender      text,
  occupation  text,
  emergency   text,
  height      int,
  weight      numeric,
  conditions  text,
  goals       text[] default '{}',
  street      text,
  city        text,
  state       text,
  postal      text,
  ref_id      text,
  tnc         boolean not null default false,
  consent     boolean not null default false,
  status      text not null default 'pending',   -- pending | added
  created_at  timestamptz not null default now()
);

alter table tablet_submissions enable row level security;
drop policy if exists tablet_submissions_staff on tablet_submissions;
create policy tablet_submissions_staff on tablet_submissions for all using (is_staff()) with check (is_staff());

alter publication supabase_realtime add table tablet_submissions;
