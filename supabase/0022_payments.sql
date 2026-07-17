-- ============================================================================
-- Cureocity — payment gateway references on invoices. Run after 0021.
-- Safe to run even before you have gateway keys (columns just stay null).
-- ============================================================================

alter table invoices add column if not exists gateway            text;
alter table invoices add column if not exists gateway_order_id   text;
alter table invoices add column if not exists gateway_payment_id text;

create index if not exists invoices_gateway_order_idx on invoices (gateway_order_id);
