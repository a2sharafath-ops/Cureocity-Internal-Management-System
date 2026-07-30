-- ============================================================================
-- Cureocity — leave policy update: entitlements, eligibility rules, and two new
-- leave types (Marriage, Bereavement). Adds staff date-of-joining + gender so
-- the rules (EL after 1 year, CL monthly pro-rata, ML female-only) can apply.
-- Run after 0096.
-- ============================================================================

-- Eligibility metadata on leave types.
alter table leave_types add column if not exists note              text;
alter table leave_types add column if not exists gender            text not null default 'any';   -- any | female | male
alter table leave_types add column if not exists min_tenure_months int  not null default 0;        -- e.g. EL: 12
alter table leave_types add column if not exists accrual           text not null default 'annual'; -- annual | monthly

-- Employment details needed for eligibility.
alter table staff add column if not exists date_of_joining date;
alter table staff add column if not exists gender          text;   -- female | male | (null = unknown)

-- Upsert the policy. Codes: EL CL SL ML PL MRL BRL LOP.
insert into leave_types (code, name, annual_days, paid, active, seq, color, note, gender, min_tenure_months, accrual) values
  ('EL',  'Annual / Earned Leave',  12, true, true, 1, '#16a34a', 'Eligible after completing 1 year',   'any',    12, 'annual'),
  ('CL',  'Casual Leave',           12, true, true, 2, '#2563eb', 'Monthly pro-rata (1 per completed month)', 'any', 0, 'monthly'),
  ('SL',  'Sick Leave',              6, true, true, 3, '#dc2626', null,                                  'any',     0, 'annual'),
  ('ML',  'Maternity Leave',       182, true, true, 4, '#db2777', '26 weeks · female staff',             'female',  0, 'annual'),
  ('PL',  'Paternity Leave',         3, true, true, 5, '#7c3aed', null,                                  'any',     0, 'annual'),
  ('MRL', 'Marriage Leave',          6, true, true, 6, '#0891b2', null,                                  'any',     0, 'annual'),
  ('BRL', 'Bereavement Leave',       3, true, true, 7, '#78716c', null,                                  'any',     0, 'annual'),
  ('LOP', 'Loss of Pay',             0, false, true, 8, '#6b7280', null,                                 'any',     0, 'annual')
on conflict (code) do update set
  name = excluded.name, annual_days = excluded.annual_days, paid = excluded.paid,
  active = excluded.active, seq = excluded.seq, color = excluded.color,
  note = excluded.note, gender = excluded.gender,
  min_tenure_months = excluded.min_tenure_months, accrual = excluded.accrual;
