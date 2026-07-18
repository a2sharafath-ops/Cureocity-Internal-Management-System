-- ============================================================================
-- Cureocity — rename the "Health Professional" staff department to "Clinical".
-- Run after 0065. (Department is an org grouping in the HR module, separate from
-- the login role which is now the specific discipline.)
-- ============================================================================

update staff set department = 'Clinical' where department = 'Health Professional';
