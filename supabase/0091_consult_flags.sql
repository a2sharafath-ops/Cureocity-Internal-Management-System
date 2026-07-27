-- Medical flags raised during a consultation (clinician-added now; an AI copilot
-- can populate the same array later). Each element: { text, severity }.
alter table consultations
  add column if not exists flags jsonb not null default '[]'::jsonb;
