-- ============================================================================
-- Cureocity — leave-type entitlement changes need Manager/Admin approval.
-- HR proposes a new annual_days (stored in pending_days); a Manager/Admin
-- approves (applies it) or rejects (clears it). Run after 0097.
-- ============================================================================

alter table leave_types add column if not exists pending_days int;          -- proposed entitlement, null when none
alter table leave_types add column if not exists pending_by   text;          -- who proposed it
alter table leave_types add column if not exists pending_at   timestamptz;   -- when proposed
