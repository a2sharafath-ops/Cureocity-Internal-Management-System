-- ============================================================================
-- Cureocity — multi-channel messaging (WhatsApp / Email / SMS) for the unified
-- Communications hub. Run after 0055.
-- ============================================================================

alter table messages          add column if not exists channel text not null default 'WhatsApp';
alter table message_templates add column if not exists channel text not null default 'WhatsApp';
