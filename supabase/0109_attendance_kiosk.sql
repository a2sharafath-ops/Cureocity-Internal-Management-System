-- ============================================================================
-- Cureocity — self-serve attendance kiosk. Run after 0108.
--
-- Staff punch in/out at a desk phone/tablet by scanning their QR badge or
-- entering name + PIN. One row per (staff, day): first punch sets check_in
-- (status present), next sets check_out and work_hours. HR can still override.
-- ============================================================================

alter table attendance add column if not exists check_in   timestamptz;
alter table attendance add column if not exists check_out  timestamptz;
alter table attendance add column if not exists work_hours numeric not null default 0;
alter table attendance add column if not exists mode       text;   -- kiosk | manual

-- Badge code (encoded in the QR) + PIN for manual identification.
alter table staff add column if not exists badge_code text;
alter table staff add column if not exists pin        text;
create unique index if not exists staff_badge_code_idx on staff (badge_code) where badge_code is not null;
