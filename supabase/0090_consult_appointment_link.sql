-- Link a consultation to the appointment it was booked from, so a clinician can
-- start the visit straight from their booked slot and the appointment's "done"
-- state stays in sync with the consultation. One consult per appointment.

alter table consultations
  add column if not exists appointment_id uuid references appointments(id) on delete set null;

create unique index if not exists consultations_appointment_uidx
  on consultations (appointment_id) where appointment_id is not null;
