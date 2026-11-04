-- LUMAR Preview only: restore least-privilege access to salon records.
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.salons FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.salons FROM authenticated;

GRANT SELECT ON TABLE public.salons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.salons TO authenticated;

DROP POLICY IF EXISTS salons_public_read_anon ON public.salons;
DROP POLICY IF EXISTS salons_read_authenticated ON public.salons;
DROP POLICY IF EXISTS salons_insert_own_authenticated ON public.salons;
DROP POLICY IF EXISTS salons_update_own_authenticated ON public.salons;
DROP POLICY IF EXISTS salons_delete_own_authenticated ON public.salons;

CREATE POLICY salons_public_read_anon
  ON public.salons
  FOR SELECT
  TO anon
  USING (is_public IS TRUE);

CREATE POLICY salons_read_authenticated
  ON public.salons
  FOR SELECT
  TO authenticated
  USING (user_id = (auth.uid())::text OR is_public IS TRUE);

CREATE POLICY salons_insert_own_authenticated
  ON public.salons
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY salons_update_own_authenticated
  ON public.salons
  FOR UPDATE
  TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

CREATE POLICY salons_delete_own_authenticated
  ON public.salons
  FOR DELETE
  TO authenticated
  USING (user_id = (auth.uid())::text);
