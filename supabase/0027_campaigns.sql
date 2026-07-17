-- ============================================================================
-- Cureocity — comms templates & campaigns. Run after 0026 (SQL Editor).
-- Reusable message templates + audience campaigns that send through the email
-- scaffold (logged to email_log; actually delivered once email keys are set).
-- ============================================================================

create table if not exists message_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text default 'General',           -- General | Onboarding | Retention | Billing | Promo
  subject    text not null,
  body       text not null,                     -- simple HTML allowed
  active     boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  template_id  uuid references message_templates(id) on delete set null,
  audience     text not null default 'all',      -- all | members | subscribers | lapsed
  status       text not null default 'draft',    -- draft | sent
  sent_count   int not null default 0,
  sent_at      timestamptz,
  created_by   text,
  created_at   timestamptz not null default now()
);

alter table message_templates enable row level security;
alter table campaigns         enable row level security;
drop policy if exists mt_staff on message_templates;
drop policy if exists cmp_staff on campaigns;
create policy mt_staff  on message_templates for all using (is_staff()) with check (is_staff());
create policy cmp_staff on campaigns         for all using (is_staff()) with check (is_staff());

insert into message_templates (name, category, subject, body) values
  ('Welcome onboarding', 'Onboarding', 'Welcome to Cureocity!', '<p>Hi {{name}},</p><p>Welcome aboard! Your journey to better health starts now. Log in to your portal any time to see your plan, sessions and reports.</p>'),
  ('Win-back offer', 'Retention', 'We miss you at Cureocity', '<p>Hi {{name}},</p><p>It has been a while! Come back this month and enjoy a complimentary session. Reply or call the front desk to book.</p>'),
  ('Payment reminder', 'Billing', 'A gentle payment reminder', '<p>Hi {{name}},</p><p>You have an outstanding balance on your account. You can pay online or at the front desk. Thank you!</p>')
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table campaigns'; exception when others then null; end;
end $$;
