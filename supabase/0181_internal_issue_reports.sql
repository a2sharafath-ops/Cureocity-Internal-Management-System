-- ============================================================================
-- Cureocity — internal staff issue reporting. Run after 0180.
-- Forward-only: creates a private report table and optional screenshot bucket.
-- No historical data is copied and no existing table is rewritten.
-- ============================================================================

begin;

create table if not exists issue_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('Bug', 'Feedback', 'Performance', 'Data concern')),
  severity text not null check (severity in ('Low', 'Medium', 'High', 'Critical')),
  description text not null check (char_length(description) between 15 and 4000),
  route text not null check (char_length(route) between 1 and 500),
  client_ref uuid,
  browser_context jsonb not null default '{}'::jsonb check (jsonb_typeof(browser_context) = 'object'),
  reporter_id uuid not null,
  reporter_name text not null,
  reporter_role text not null,
  submission_key text not null check (char_length(submission_key) between 1 and 100),
  attachment_bucket text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer check (attachment_size is null or attachment_size between 1 and 5242880),
  status text not null default 'Open' check (status in ('Open', 'In progress', 'Resolved', 'Dismissed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  triaged_by uuid,
  triaged_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (reporter_id, submission_key),
  check ((attachment_bucket is null) = (attachment_path is null))
);

create index if not exists issue_reports_status_created_idx
  on issue_reports(status, created_at desc);
create index if not exists issue_reports_reporter_idx
  on issue_reports(reporter_id, created_at desc);

alter table issue_reports enable row level security;
drop policy if exists issue_reports_insert_own on issue_reports;
drop policy if exists issue_reports_read_own_or_admin on issue_reports;
drop policy if exists issue_reports_admin_update on issue_reports;

create policy issue_reports_insert_own on issue_reports for insert to authenticated
  with check (is_staff() and reporter_id = auth.uid() and status = 'Open');
create policy issue_reports_read_own_or_admin on issue_reports for select to authenticated
  using (reporter_id = auth.uid() or my_role() in ('Super Admin', 'Administrator'));
create policy issue_reports_admin_update on issue_reports for update to authenticated
  using (my_role() in ('Super Admin', 'Administrator'))
  with check (my_role() in ('Super Admin', 'Administrator'));

grant select, insert, update on issue_reports to authenticated;
revoke delete on issue_reports from authenticated;

create or replace function attach_issue_screenshot(
  target_report_id uuid,
  target_path text,
  target_name text,
  target_type text,
  target_size integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or target_type not in ('image/png', 'image/jpeg', 'image/webp')
     or target_size not between 1 and 5242880
     or target_path not like auth.uid()::text || '/' || target_report_id::text || '/%'
     or char_length(target_name) not between 1 and 200 then
    raise exception 'Invalid issue screenshot metadata';
  end if;

  update issue_reports set
    attachment_bucket = 'issue-attachments',
    attachment_path = target_path,
    attachment_name = target_name,
    attachment_type = target_type,
    attachment_size = target_size,
    updated_at = now()
  where id = target_report_id
    and reporter_id = auth.uid()
    and status = 'Open'
    and attachment_path is null;

  if not found then
    raise exception 'Issue report is not available for an attachment';
  end if;
end;
$$;

revoke all on function attach_issue_screenshot(uuid, text, text, text, integer) from public;
grant execute on function attach_issue_screenshot(uuid, text, text, text, integer) to authenticated;

insert into storage.buckets (id, name, public)
values ('issue-attachments', 'issue-attachments', false)
on conflict (id) do nothing;

drop policy if exists issue_attachments_insert_own on storage.objects;
drop policy if exists issue_attachments_read_own_or_admin on storage.objects;
drop policy if exists issue_attachments_delete_own on storage.objects;

create policy issue_attachments_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'issue-attachments'
    and is_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy issue_attachments_read_own_or_admin on storage.objects for select to authenticated
  using (
    bucket_id = 'issue-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text
      or my_role() in ('Super Admin', 'Administrator'))
  );
create policy issue_attachments_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'issue-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table issue_reports is
  'Internal operational bug/feedback reports. Descriptions should not contain secrets or clinical content.';

commit;
