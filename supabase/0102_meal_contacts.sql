-- ============================================================================
-- Cureocity — meal-monitoring contact ladder. When a client isn't logging meals
-- via the portal, the dietitian escalates: WhatsApp → call → in-person. Each
-- attempt is recorded so the escalation is visible and auditable. Run after 0101.
-- ============================================================================

create table if not exists meal_contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references clients(id) on delete cascade,
  date       date not null default current_date,
  channel    text not null,               -- portal | whatsapp | call | meet
  outcome    text not null default 'no_response',  -- reached | no_response
  note       text,
  staff      text,
  created_at timestamptz not null default now()
);
create index if not exists meal_contacts_client_date_idx on meal_contacts (client_id, date);

alter table meal_contacts enable row level security;
drop policy if exists meal_contacts_staff on meal_contacts;
create policy meal_contacts_staff on meal_contacts for all using (is_staff()) with check (is_staff());
do $$ begin execute 'alter publication supabase_realtime add table meal_contacts'; exception when others then null; end $$;
