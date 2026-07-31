-- ============================================================================
-- Cureocity — employee identity & bank details for payslips. Run after 0105.
-- Adds the fields the payslip needs beyond salary: employee code, work location
-- and bank account (name / A/c no / IFSC).
-- ============================================================================

alter table staff add column if not exists emp_code      text;
alter table staff add column if not exists work_location text;
alter table staff add column if not exists bank_name     text;
alter table staff add column if not exists bank_account  text;
alter table staff add column if not exists ifsc          text;
