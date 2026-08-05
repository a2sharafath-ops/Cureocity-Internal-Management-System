-- ============================================================================
-- Cureocity — issued documents. Run after 0127.
--
-- Until now every printable document existed only as a web page. Two problems
-- with that, and the second is the serious one:
--
--   1. WhatsApp cannot send a page. Wati fetches a URL and expects PDF bytes.
--
--   2. A page renders TODAY'S data. Revise a diet plan and yesterday's print
--      URL quietly shows the new one — so there is no way to show what a client
--      was actually handed on the day. For a document carrying calorie targets,
--      drug doses and lab requests, that is a real gap. A stored file is frozen
--      at the moment of issue.
--
-- One row per rendered file. Re-issuing writes a NEW row rather than replacing
-- one, so the history of what was sent stays intact.
-- ============================================================================

create table if not exists issued_documents (
  id          uuid primary key default gen_random_uuid(),
  -- plan | rx | lab | summary — which document, and the row it was built from.
  kind        text not null check (kind in ('plan', 'rx', 'lab', 'summary')),
  ref_id      uuid not null,
  client_id   uuid references clients(id) on delete cascade,

  -- Path inside the private `documents` bucket. Never a public URL: these are
  -- clinical documents, reached through a short-lived signed link.
  path        text not null,
  file_name   text not null,
  bytes       int,
  -- Which renderer produced it, so a batch of bad output is traceable.
  provider    text,

  issued_by   text,
  issued_at   timestamptz not null default now(),
  -- Delivery is recorded separately from creation: a file can exist without
  -- having been sent, and knowing which is which is the point of the table.
  sent_at     timestamptz,
  sent_to     text,               -- the WhatsApp number / email it went to
  send_error  text
);
create index if not exists issued_documents_ref_idx    on issued_documents (kind, ref_id, issued_at desc);
create index if not exists issued_documents_client_idx on issued_documents (client_id, issued_at desc);

alter table issued_documents enable row level security;
drop policy if exists issued_documents_staff  on issued_documents;
drop policy if exists issued_documents_client on issued_documents;
create policy issued_documents_staff on issued_documents for all
  using (is_staff()) with check (is_staff());
-- A client may see the list of what they were sent. Reading the FILE still
-- needs a signed link, which the app issues per request.
create policy issued_documents_client on issued_documents for select
  using (client_id = my_client_id() and sent_at is not null);

-- ---- private bucket ---------------------------------------------------------
-- Deliberately NOT public, unlike `branding`. Branding is clinic stationery;
-- these are a named person's clinical documents.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

drop policy if exists documents_staff_read  on storage.objects;
drop policy if exists documents_staff_write on storage.objects;
create policy documents_staff_read on storage.objects for select
  using (bucket_id = 'documents' and is_staff());
create policy documents_staff_write on storage.objects for all
  using (bucket_id = 'documents' and is_staff())
  with check (bucket_id = 'documents' and is_staff());

-- ---- check afterwards -------------------------------------------------------
--   select kind, file_name, bytes, provider, issued_at, sent_at
--     from issued_documents order by issued_at desc limit 10;
