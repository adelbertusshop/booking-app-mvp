-- Restrict anonymous reads to salons explicitly published for online booking.
-- Safe to run when the same final policy names already exist from an earlier
-- production migration. Owner policies remain unchanged.

-- Remove legacy and current public-read policy names before recreating them.
DROP POLICY IF EXISTS "Anyone can read salons" ON public.salons;
DROP POLICY IF EXISTS "Public salons are viewable by everyone" ON public.salons;
CREATE POLICY "Public salons are viewable by everyone"
  ON public.salons
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Anyone can read services" ON public.services;
DROP POLICY IF EXISTS "Public services are viewable by everyone" ON public.services;
DROP POLICY IF EXISTS "Services for public salons are viewable by everyone" ON public.services;
CREATE POLICY "Services for public salons are viewable by everyone"
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salons AS s
      WHERE s.id = services.salon_id
        AND s.is_public = true
    )
  );

DROP POLICY IF EXISTS "Anyone can read hours" ON public.salon_hours;
DROP POLICY IF EXISTS "Hours for public salons are viewable by everyone" ON public.salon_hours;
CREATE POLICY "Hours for public salons are viewable by everyone"
  ON public.salon_hours
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salons AS s
      WHERE s.id = salon_hours.salon_id
        AND s.is_public = true
    )
  );
