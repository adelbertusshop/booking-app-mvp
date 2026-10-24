-- Appointment times must be unique by salon, not globally by provider.
-- Keep appointments_no_active_overlap: it prevents overlapping active bookings within one salon.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS unique_appointment_time;
