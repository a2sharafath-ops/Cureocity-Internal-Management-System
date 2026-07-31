-- ============================================================================
-- Cureocity — optional GST on a staff member's salary breakup. Run after 0107.
-- Manually entered per employee (0 for most); added as an earning so it flows
-- into gross, net, payroll and the payslip.
-- ============================================================================

alter table salary_structures add column if not exists gst numeric not null default 0;
