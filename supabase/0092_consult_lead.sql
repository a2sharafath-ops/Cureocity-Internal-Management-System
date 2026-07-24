-- ============================================================================
-- Cureocity — let a consultation attach to a LEAD, not just a client.
--
-- A free pre-sale trial (fitness assessment) is booked against a lead. To run
-- the same Start → inputs → Complete → summary console flow as a paying
-- client's assessment, the consultation it produces must be able to hang off a
-- lead. `client_id` is already nullable; add a parallel `lead_id`.
--
-- On conversion the trial consultation is re-parented to the new client
-- (see carryExperienceToClient) so the assessment that sold them the package
-- stays in their history.
--
-- RLS is unchanged: the consultations read/write policies key off `kind`
-- (can_read_consult_kind / owns_consult_kind), not the client link, so a
-- lead-based row is already governed by the right discipline.
-- ============================================================================

alter table consultations
  add column if not exists lead_id uuid references leads(id) on delete cascade;

create index if not exists consultations_lead_idx on consultations (lead_id);

-- A consultation belongs to exactly one subject: a client or a lead (never
-- neither). Existing rows all have client_id, so this is safe to add.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'consultations_subject_ck') then
    alter table consultations
      add constraint consultations_subject_ck
      check (client_id is not null or lead_id is not null);
  end if;
end $$;
