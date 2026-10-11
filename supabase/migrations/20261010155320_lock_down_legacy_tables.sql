-- Defense in depth: legacy tables are not used by the current LUMAR app.
-- Remove direct API privileges for client-facing roles; service_role/admin access is unaffected.
REVOKE ALL PRIVILEGES ON TABLE public.admin_settings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.bookings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.providers FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.provider_availability FROM anon, authenticated;
