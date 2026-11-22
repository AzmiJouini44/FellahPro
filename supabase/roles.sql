-- Apply before application migrations on a fresh database (CLI: --include-roles).
-- This changes only postgres's defaults for future public tables and views.
-- Global defaults, Storage defaults, and service_role grants are preserved.
-- Existing tables require a separate permission review.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
