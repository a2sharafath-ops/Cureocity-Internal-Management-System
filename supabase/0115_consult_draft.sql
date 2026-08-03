-- Scratch space for a consultation still in progress.
--
-- The console autosaves the questionnaire, flags and summary into their own
-- columns. Vitals had nowhere to go: they only existed in the browser until
-- someone pressed "Save vitals", so a closed tab lost them — and pressing the
-- questionnaire's Save re-rendered the page and wiped whatever was typed into
-- the vitals boxes.
--
-- `draft` holds that in-progress state (currently { vitals: {...} }). It is a
-- scratch pad, not a record: the real vitals row is still written to `vitals`
-- when the clinician saves or completes.

alter table consultations add column if not exists draft jsonb;

-- Verify:
--   select id, kind, status, draft from consultations where draft is not null;
