-- ============================================================================
-- Cureocity — enable Supabase Realtime on the app tables so the UI updates live.
-- Run any time after the tables exist (SQL Editor -> New query -> paste -> Run).
-- Realtime respects RLS: a subscriber only receives change events for rows they
-- are allowed to SELECT.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'clients','leads','sessions','consultations','blood_requests',
    'blueprints','meal_logs','measurements','files','packages'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception
      when duplicate_object then null;  -- already in the publication
      when others then null;
    end;
  end loop;
end $$;
