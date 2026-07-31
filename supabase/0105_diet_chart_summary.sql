-- ============================================================================
-- Cureocity — diet chart plan summary. Run after 0104.
--
-- A free-text summary of the diet plan the dietitian can type or paste (or draft
-- with AI), separate from the per-meal rows and the client "notes". It appears
-- on the printable PDF and travels with the chart through review → publish.
-- ============================================================================

alter table diet_charts add column if not exists summary text;
