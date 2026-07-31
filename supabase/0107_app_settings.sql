-- ============================================================================
-- Cureocity — Templates & Branding. Run after 0106.
--
-- One JSON row holding editable branding + document templates (logo, brand
-- colour, font, letterhead, consultation-letter text, diet-chart & prescription
-- defaults). Publicly readable so the logo/brand apply on every page including
-- sign-in and printable PDFs; only Administrators / Super Admins may edit.
-- ============================================================================

create table if not exists app_settings (
  id         int primary key default 1,
  data       jsonb not null default '{}',
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into app_settings (id, data) values (1, '{}') on conflict (id) do nothing;

alter table app_settings enable row level security;
drop policy if exists app_settings_read  on app_settings;
drop policy if exists app_settings_write on app_settings;
create policy app_settings_read  on app_settings for select using (true);
create policy app_settings_write on app_settings for all
  using (my_role() in ('Administrator', 'Super Admin')) with check (my_role() in ('Administrator', 'Super Admin'));

do $$ begin execute 'alter publication supabase_realtime add table app_settings'; exception when others then null; end $$;
