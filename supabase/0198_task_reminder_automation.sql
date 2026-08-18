-- Staff task-reminder contact preferences.  This does not enable delivery:
-- TASK_REMINDERS_ENABLED and TASK_REMINDERS_WHATSAPP_ENABLED must both be
-- explicitly enabled at runtime, and Wati must have an approved template.
-- Never reuse client phone/consent fields for staff operational reminders.

begin;

alter table public.staff
  add column if not exists task_reminder_phone text,
  add column if not exists task_reminder_whatsapp_opt_in boolean not null default false;

comment on column public.staff.task_reminder_phone is
  'Staff-confirmed WhatsApp number solely for optional Cureocity task reminders.';
comment on column public.staff.task_reminder_whatsapp_opt_in is
  'Explicit staff opt-in for generic task WhatsApp reminders; false disables delivery.';

commit;
