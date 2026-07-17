-- ============================================================================
-- Cureocity — national health identity (ABHA / UHID) on clients.
-- Run after 0040 (SQL Editor). Safe to run anytime.
-- ============================================================================

alter table clients add column if not exists abha_id text;   -- Ayushman Bharat Health Account (14-digit)
alter table clients add column if not exists uhid    text;    -- Unique Health ID (hospital-issued)
