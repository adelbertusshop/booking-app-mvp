import { z } from 'zod';

export const bookingSchema = z.object({
  firstName: z
    .string()
    .min(2, 'Imię musi mieć co najmniej 2 znaki'),
  lastName: z
    .string()
    .min(2, 'Nazwisko musi mieć co najmniej 2 znaki'),
  email: z
    .string()
    .email('Wprowadź poprawny adres e-mail'),
  phone: z
    .string()
    .regex(/^[0-9+\s-]{9,15}$/, 'Wprowadź poprawny numer telefonu (np. 123456789)'),
  date: z
    .string()
    .min(1, 'Wybór daty jest wymagany'),
  time: z
    .string()
    .min(1, 'Wybór godziny jest wymagany'),
});

export type BookingFormData = z.infer<typeof bookingSchema>;