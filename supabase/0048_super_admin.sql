-- ============================================================================
-- Cureocity — elevate the current admin account to Super Admin (Sharafath).
-- Super Admin sits above Administrator and has full access to every module.
-- Run after 0047.
-- ============================================================================

update profiles
   set role = 'Super Admin',
       name = 'Sharafath Athimannil'
 where email = 'admin@cureo.city';
