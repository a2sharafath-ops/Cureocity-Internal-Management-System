-- ============================================================================
-- Cureocity — stop six tables being readable without logging in. Run after 0133.
--
-- Supabase ships the anon key in the browser bundle; that is by design. What is
-- NOT by design is a policy written as `using (true)` or with no role clause,
-- because that grants the anon role too. Anyone who opened the site — no
-- account, no password — could read these straight from the REST API:
--
--   pass_types, products      the price list and retail catalogue
--   package_prices,
--   package_services          what each package costs and contains
--   forms                     the intake and CONSENT form definitions
--
-- Commercially awkward rather than a patient-data breach: none of these hold
-- client information. The forms table is the one that actually matters — it is
-- the wording of the consents the clinic asks people to sign.
--
-- `app_settings` is deliberately left public: the login screen reads branding
-- from it before anyone has signed in. See the note at the bottom.
-- ============================================================================

do $$ declare t text;
begin
  foreach t in array array['pass_types', 'products', 'package_prices', 'package_services', 'forms']
  loop
    -- Read: any signed-in user. Staff need it to sell and to assign forms;
    -- clients need prices and their own form definitions in the portal.
    execute format('drop policy if exists %I_public_read on %I', t, t);
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format(
      'create policy %I_read on %I for select to authenticated using (true)', t, t);

    -- Write: staff only, unchanged in substance — but now stated explicitly
    -- rather than inherited from a broad policy.
    execute format('drop policy if exists %I_write on %I', t, t);
    execute format(
      'create policy %I_write on %I for all to authenticated using (is_staff()) with check (is_staff())', t, t);
  end loop;
end $$;


-- ---- app_settings stays readable by anon, on purpose -----------------------
--
-- The sign-in page renders the clinic's logo and name from it, and that happens
-- before there is a session. Narrowing it would give every user a grey login
-- screen.
--
-- The risk is not the branding — it is that `app_settings.payload` is free-form
-- jsonb an Administrator edits. Anything ever pasted in there is world-readable:
-- a webhook URL, an API key, an internal note. Worth a look now and then:
--
--   select jsonb_pretty(payload) from app_settings;


-- ---- id sequences were granted to anon -------------------------------------
--
-- next_invoice_num() and next_client_code() advance a counter. Granted to anon,
-- anyone could call them repeatedly and burn numbers, leaving permanent gaps in
-- the invoice series — which matters for a statutory audit in India.
revoke execute on function next_invoice_num() from anon;
revoke execute on function next_client_code() from anon;


-- ---- verification ----------------------------------------------------------
-- Should list only 'authenticated' (no 'anon', no '{public}') for these five:
--
--   select tablename, policyname, roles from pg_policies
--    where tablename in ('pass_types','products','package_prices','package_services','forms')
--    order by tablename, policyname;
--
-- And a quick negative test — run with the ANON key, not the service key:
--   curl "$SUPABASE_URL/rest/v1/forms?select=id" -H "apikey: $ANON_KEY"
--   → should come back as an empty array, not your form definitions.
