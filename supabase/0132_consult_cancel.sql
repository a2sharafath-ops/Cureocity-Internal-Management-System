-- =============================================================================
-- Cureocity — a consultation can now be cancelled. Run after 0131.
--
-- `consultations.status` is free text ('scheduled' | 'completed'), so no schema
-- change is needed to store 'cancelled'. What DOES need changing is the one
-- place the meaning of "outstanding" is baked into SQL: the dashboard counter,
-- which reads `status <> 'completed'`. Left alone, every cancelled consultation
-- would keep showing up as work somebody still owes.
--
-- The application-side counters are fixed in the same commit. This is the only
-- copy of the rule that lives in the database.
--
-- Nothing here deletes or rewrites any existing row.
-- =============================================================================

create or replace function dashboard_counts(p_today date)
returns table (
  consults_pending int, sessions_today int, orders_open int,
  blood_pending int, appts_today int, meals_today int
) language plpgsql security definer stable set search_path = public as $$
begin
  if not is_staff() then return; end if;
  return query select
    -- was: status <> 'completed'
    (select count(*) from consultations  where status not in ('completed', 'cancelled'))::int,
    (select count(*) from sessions       where date = p_today and status = 'scheduled')::int,
    (select count(*) from orders         where status in ('ordered','collected'))::int,
    (select count(*) from blood_requests where submitted = false)::int,
    (select count(*) from appointments   where date = p_today and status = 'scheduled')::int,
    (select count(*) from meal_logs      where date = p_today)::int;
end $$;

-- Deleting a consultation is governed by the existing `consultations_write`
-- policy, which is `for all using (owns_consult_kind(kind))` — the owning
-- discipline plus admins. That already covers DELETE, so no policy change.
--
-- To see what has been cancelled, and by whom:
--   select * from audit_log where action like 'Consultation cancel%' order by created_at desc;
--   select * from audit_log where action = 'Consultation deleted'   order by created_at desc;
