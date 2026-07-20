-- ============================================================================
-- Cureocity — pause / freeze a client's package. Run after 0074.
--
-- A real front-desk job: the client travels, gets injured, or asks to hold.
-- Until now there was nowhere to record it, so validity kept counting down
-- while the client wasn't training — they silently lost days they'd paid for.
--
-- Two columns:
--   frozen      the date the pause STARTED. Null means running normally.
--   freeze_days total days already banked from previous completed pauses.
--
-- The end date is therefore: start + validity + freeze_days (+ days elapsed
-- since `frozen`, while a pause is open). Keeping the running pause separate
-- from the banked total means the figure stays correct mid-pause without a
-- nightly job to tick it along.
-- ============================================================================

alter table clients add column if not exists frozen      date;
alter table clients add column if not exists freeze_days int not null default 0;

comment on column clients.frozen is
  'Date the current pause began; null when the package is running.';
comment on column clients.freeze_days is
  'Days banked from previous completed pauses, added to package validity.';

-- Same idea on the package history rows, so a client with several packages
-- keeps the extension attached to the right one.
alter table client_packages add column if not exists frozen      date;
alter table client_packages add column if not exists freeze_days int not null default 0;

create index if not exists clients_frozen_idx on clients (frozen) where frozen is not null;
