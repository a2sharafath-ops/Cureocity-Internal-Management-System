-- Explicitly remove browser-facing execution inherited from Supabase's
-- default function privileges. The RPCs below are invoked only by guarded
-- server actions/webhooks using the service-role client.
begin;

revoke all on function billing_actor_allowed(text[])
  from public, anon, authenticated;
revoke all on function purchase_package_atomic(text, uuid, text, date, numeric, text, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function renew_package_atomic(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function void_client_package_atomic(text, uuid, text)
  from public, anon, authenticated;
revoke all on function refund_invoice_atomic(text, uuid, text)
  from public, anon, authenticated;
revoke all on function renew_subscription_atomic(text, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function settle_online_invoice_atomic(uuid, text, text, bigint, text, text)
  from public, anon, authenticated;

grant execute on function billing_actor_allowed(text[]) to service_role;
grant execute on function purchase_package_atomic(text, uuid, text, date, numeric, text, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function renew_package_atomic(text, uuid, text, text) to service_role;
grant execute on function void_client_package_atomic(text, uuid, text) to service_role;
grant execute on function refund_invoice_atomic(text, uuid, text) to service_role;
grant execute on function renew_subscription_atomic(text, uuid, text, boolean) to service_role;
grant execute on function settle_online_invoice_atomic(uuid, text, text, bigint, text, text) to service_role;

-- Staff may attach screenshots to their own app feedback reports, but the
-- anonymous API role must never execute this security-definer helper.
revoke all on function attach_issue_screenshot(uuid, text, text, text, integer)
  from public, anon;
grant execute on function attach_issue_screenshot(uuid, text, text, text, integer)
  to authenticated, service_role;

commit;
