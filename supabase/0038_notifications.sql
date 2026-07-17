-- ============================================================================
-- Cureocity — in-app notifications (bell). Run after 0037 (SQL Editor).
-- Per-user notifications; staff can create them for teammates, each user only
-- reads and clears their own.
-- ============================================================================

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,           -- auth.users.id / profiles.id of the recipient
  title      text not null,
  body       text,
  href       text,
  icon       text default '🔔',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, read, created_at desc);

alter table notifications enable row level security;
drop policy if exists notif_own_read  on notifications;
drop policy if exists notif_own_upd   on notifications;
drop policy if exists notif_staff_ins on notifications;
create policy notif_own_read  on notifications for select using (user_id = auth.uid());
create policy notif_own_upd   on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_staff_ins on notifications for insert with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table notifications'; exception when others then null; end;
end $$;
