-- ============================================================================
-- Cureocity — SOPs / internal knowledge base. Run after 0032 (SQL Editor).
-- ============================================================================

create table if not exists sops (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  category   text default 'Operations',   -- Operations | Clinical | Compliance | HR
  content    text,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table sops enable row level security;
drop policy if exists sops_staff on sops;
create policy sops_staff on sops for all using (is_staff()) with check (is_staff());

insert into sops (title, category, content) values
  ('Client Onboarding SOP', 'Operations', '1. Verify contact details and consent forms. 2. Assign package and professional in the system. 3. Collect advance payment or share a payment link. 4. Book the initial assessment slot. 5. Send the welcome message with portal access.'),
  ('Consultation Documentation Guide', 'Clinical', 'Every session must have a session note within 24 hours. Initial consults require a full assessment with at least two metrics. Share assessments with clients only after professional review.'),
  ('Data Privacy Policy', 'Compliance', 'Client health records are visible only to the assigned professional and admin. Documents are shared to the portal on a per-file basis. Never send health records over personal messaging apps.')
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table sops'; exception when others then null; end;
end $$;
