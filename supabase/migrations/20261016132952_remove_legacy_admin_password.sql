-- Remove the legacy plaintext admin credential from the obsolete settings table.
-- Current admin authentication uses Supabase Auth; app/admin/page.tsx does not read admin_settings.
-- Keep the table and column for now to avoid destructive schema cleanup, but remove the default and stored values.

ALTER TABLE public.admin_settings
  ALTER COLUMN admin_password DROP DEFAULT;

UPDATE public.admin_settings
SET admin_password = NULL
WHERE admin_password IS NOT NULL;
