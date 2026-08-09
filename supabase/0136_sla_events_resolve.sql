-- Let a fired care-turnaround alert be retired.
--
-- blueprint_sla_events was insert-only. The nightly sweeps wrote a row the
-- moment a gate breached and never touched it again, and the daily Whiteboard
-- read every breach row as a live red alert on the client.
--
-- So a diet chart written one hour late on day 3 put "Care turnaround overdue"
-- on that client's row in red, every working day, for the rest of their
-- package. The dashboard queue was clean, the protocol board showed the gate
-- met, and only the Whiteboard still said it was on fire — and because the
-- board asks for a reason and a solution against each alert, and asks again
-- each new session, the coach had to keep answering for work that had been
-- finished weeks earlier. Nothing in the app could clear it.
--
-- `resolved_at` is what the sweep sets once the gate's clock is no longer
-- breached or due. The row stays for the record; it just stops shouting.

alter table blueprint_sla_events
  add column if not exists resolved_at timestamptz;

-- The Whiteboard and the dedupe check both read "still open", so index that.
create index if not exists blueprint_sla_events_open_idx
  on blueprint_sla_events (client_id) where resolved_at is null;

-- Existing rows are all pre-fix and unknowable: some are genuinely still late,
-- most are long since done. Leaving them open would keep every one of them red.
-- Closing them is the honest reset — tonight's sweep re-opens any gate that is
-- actually still breached, so nothing real is lost, and only what is real comes
-- back.
update blueprint_sla_events
   set resolved_at = now()
 where resolved_at is null;
