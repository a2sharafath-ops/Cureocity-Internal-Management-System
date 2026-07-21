-- ============================================================================
-- Cureocity — free experience sessions for leads. Run after 0079.
--
-- Today an appointment must belong to a client, and a client can't exist
-- without a package. So the motion the sales team actually runs — let them try
-- it, then sell — cannot be recorded at all. A lead who came in, did a fitness
-- assessment and took a trial session leaves no trace until they pay.
--
-- This makes `appointments` and `sessions` belong to EITHER a lead or a
-- client, never both and never neither. On conversion the rows move across, so
-- the client's history starts at their first real visit rather than at the
-- moment money changed hands.
--
-- The entitlement — one assessment and one training session per lead — is
-- enforced by a partial unique index rather than application code, because
-- "free trial" without a limit is just free training.
-- ============================================================================

begin;

-- ---- appointments: lead OR client ------------------------------------------
alter table appointments add column if not exists lead_id uuid references leads(id) on delete cascade;

-- Existing rows all have client_id, so the constraint is satisfiable now.
-- NOT VALID would let bad rows in later; we want it enforced from the start.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_owner_chk') then
    alter table appointments add constraint appointments_owner_chk
      check ((client_id is not null) <> (lead_id is not null));
  end if;
end $$;

create index if not exists appointments_lead_idx on appointments (lead_id);

comment on column appointments.lead_id is
  'Set for pre-sale experience sessions. Exactly one of lead_id / client_id.';

-- ---- sessions: same shape --------------------------------------------------
alter table sessions add column if not exists lead_id uuid references leads(id) on delete cascade;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_owner_chk') then
    alter table sessions add constraint sessions_owner_chk
      check ((client_id is not null) <> (lead_id is not null));
  end if;
end $$;

create index if not exists sessions_lead_idx on sessions (lead_id);

-- `sessions.trainer_id` is NOT NULL and `seq` assumes a numbered plan; an
-- experience session is a one-off, so it gets seq 0 to stay out of the way of
-- a real 12-session block later.
alter table sessions alter column client_id drop not null;

-- ---- the entitlement -------------------------------------------------------
-- One free experience appointment per lead per kind. A partial unique index
-- rather than a check constraint, because it has to count rows.
--
-- Cancelled bookings are excluded: a lead who cancelled and rebooked hasn't
-- used their entitlement, and telling them otherwise would be wrong.
alter table appointments add column if not exists is_experience boolean not null default false;

create unique index if not exists appointments_one_experience_per_kind
  on appointments (lead_id, type)
  where lead_id is not null and is_experience and status <> 'cancelled';

alter table sessions add column if not exists is_experience boolean not null default false;

create unique index if not exists sessions_one_experience_per_lead
  on sessions (lead_id)
  where lead_id is not null and is_experience and status <> 'cancelled';

comment on column appointments.is_experience is
  'Free pre-sale trial. One per lead per type, enforced by a partial unique index.';

commit;

-- Verify:
--   select count(*) from appointments where lead_id is not null;
--   select conname from pg_constraint where conname like '%owner_chk';
--   -- should fail:
--   -- insert into appointments (client_id, lead_id, date) values (null, null, now());
