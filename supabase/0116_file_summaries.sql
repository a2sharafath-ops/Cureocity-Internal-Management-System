-- Medical reports: keep a report's summary with the document itself.
--
-- Blood panels, thyroid profiles, ECGs and the rest arrive as PDFs the clinician
-- uploads. Until now a file was only a document to open — nothing carried what
-- it *said*, so the findings lived in someone's head or got re-typed into the
-- consultation notes.
--
-- The summary belongs to the file (one document, one summary), so these are
-- columns on `files` rather than a separate table that would only ever be joined
-- back 1:1.

alter table files add column if not exists summary      text;        -- extracted or AI-written
alter table files add column if not exists summary_at   timestamptz; -- when it was produced
alter table files add column if not exists report_date  date;        -- date on the report itself
alter table files add column if not exists report_label text;        -- "Blood panel", "Thyroid profile", …

create index if not exists files_client_kind_idx on files (client_id, kind, created_at desc);

-- Verify:
--   select id, name, kind, report_label, report_date, left(summary, 60)
--   from files where client_id = '<client>' order by created_at desc;
