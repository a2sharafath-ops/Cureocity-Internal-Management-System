-- ============================================================================
-- Cureocity — file uploads (blood-report PDFs, progress photos) via Storage.
-- Run after 0006 (SQL Editor -> New query -> paste -> Run).
--
-- Creates a private 'client-files' storage bucket, a files metadata table, and
-- RLS so staff manage all files while a client can read/upload only files under
-- their own client-id folder.
-- ============================================================================

-- ---- files metadata --------------------------------------------------------
create table if not exists files (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  bucket      text not null default 'client-files',
  path        text not null,
  name        text,
  kind        text not null default 'document',  -- blood_report | progress_photo | document
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists files_client_idx on files (client_id);

alter table files enable row level security;
drop policy if exists files_staff         on files;
drop policy if exists files_client_read   on files;
drop policy if exists files_client_insert on files;
create policy files_staff         on files for all    using (is_staff()) with check (is_staff());
create policy files_client_read   on files for select using (client_id = my_client_id());
create policy files_client_insert on files for insert with check (client_id = my_client_id());

-- ---- storage bucket + policies ---------------------------------------------
insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

drop policy if exists "cf staff all"     on storage.objects;
drop policy if exists "cf client read"   on storage.objects;
drop policy if exists "cf client insert" on storage.objects;

create policy "cf staff all" on storage.objects for all
  using (bucket_id = 'client-files' and is_staff())
  with check (bucket_id = 'client-files' and is_staff());

create policy "cf client read" on storage.objects for select
  using (bucket_id = 'client-files' and (storage.foldername(name))[1] = my_client_id()::text);

create policy "cf client insert" on storage.objects for insert
  with check (bucket_id = 'client-files' and (storage.foldername(name))[1] = my_client_id()::text);
