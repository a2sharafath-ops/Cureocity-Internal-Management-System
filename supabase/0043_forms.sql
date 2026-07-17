-- ============================================================================
-- Cureocity — dynamic intake & consent forms. Run after 0042 (SQL Editor).
-- ============================================================================

create table if not exists forms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text default 'intake',        -- intake | consent
  fields     jsonb not null default '[]',   -- [{label, kind}]  kind: text|textarea|checkbox|select|yesno
  active     boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists form_responses (
  id         uuid primary key default gen_random_uuid(),
  form_id    uuid references forms(id) on delete cascade,
  client_id  uuid references clients(id) on delete cascade,
  answers    jsonb not null default '{}',
  status     text not null default 'pending',   -- pending | completed
  signed_by  text,
  signed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists form_responses_client_idx on form_responses (client_id);
create index if not exists form_responses_form_idx   on form_responses (form_id);

alter table forms          enable row level security;
alter table form_responses enable row level security;

drop policy if exists forms_staff on forms;
drop policy if exists forms_read  on forms;
create policy forms_staff on forms for all    using (is_staff()) with check (is_staff());
create policy forms_read  on forms for select using (true);

drop policy if exists fr_staff        on form_responses;
drop policy if exists fr_client_read  on form_responses;
drop policy if exists fr_client_write on form_responses;
create policy fr_staff        on form_responses for all    using (is_staff()) with check (is_staff());
create policy fr_client_read  on form_responses for select using (client_id = my_client_id());
create policy fr_client_write on form_responses for update using (client_id = my_client_id()) with check (client_id = my_client_id());

insert into forms (name, type, fields) values
  ('New Client Intake', 'intake', '[{"label":"Current medications","kind":"textarea"},{"label":"Known allergies","kind":"text"},{"label":"Past injuries / surgeries","kind":"textarea"},{"label":"Primary goal","kind":"text"},{"label":"Cleared by a doctor to exercise?","kind":"yesno"}]'),
  ('Consent to Treat', 'consent', '[{"label":"I consent to assessment and treatment by Cureocity professionals","kind":"checkbox"},{"label":"I understand session and cancellation policies","kind":"checkbox"},{"label":"I consent to storage of my health records","kind":"checkbox"}]')
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table form_responses'; exception when others then null; end;
end $$;
