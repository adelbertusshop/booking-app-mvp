import { supabase } from './supabase'

export interface Slot {
  time: string
  available: boolean
}

export interface BookingCheck {
  date: string
  time: string
  service_duration: number // w minutach
  provider_slug?: string
}

/**
 * Generuje wszystkie możliwe sloty w danym dniu
 */
export function generateAllSlots(
  startHour: number = 8,
  endHour: number = 18,
  intervalMinutes: number = 30
): string[] {
  const slots: string[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += intervalMinutes) {
      const hour = h.toString().padStart(2, '0')
      const minute = m.toString().padStart(2, '0')
      slots.push(`${hour}:${minute}`)
    }
  }
  return slots
}

/**
 * Pobiera zajęte sloty z bazy dla danego dnia i providera
 */
export async function getBookedSlots(
  date: string,
  providerSlug?: string
): Promise<{ time: string; duration: number }[]> {
  let query = supabase
    .from('bookings')
    .select('time, service_duration')
    .eq('date', date)
    .not('status', 'eq', 'cancelled')

  if (providerSlug) {
    query = query.eq('provider_slug', providerSlug)
  }

  const { data, error } = await query

  if (error) {
    console.error('Błąd pobierania rezerwacji:', error)
    return []
  }

  return (data || []).map((b) => ({
    time: b.time,
    duration: b.service_duration || 30,
  }))
}

/**
 * Sprawdza czy slot koliduje z już zarezerwowanym
 */
function isOverlapping(
  slotTime: string,
  slotDuration: number,
  bookedTime: string,
  bookedDuration: number
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const slotStart = toMinutes(slotTime)
  const slotEnd = slotStart + slotDuration
  const bookedStart = toMinutes(bookedTime)
  const bookedEnd = bookedStart + bookedDuration

  return slotStart < bookedEnd && slotEnd > bookedStart
}

/**
 * Zwraca tylko wolne sloty dla danego dnia
 */
export async function getAvailableSlots(
  date: string,
  serviceDuration: number = 30,
  providerSlug?: string,
  startHour: number = 8,
  endHour: number = 18,
  intervalMinutes: number = 30
): Promise<string[]> {
  const allSlots = generateAllSlots(startHour, endHour, intervalMinutes)
  const bookedSlots = await getBookedSlots(date, providerSlug)

  const available = allSlots.filter((slot) => {
    // Sprawdź czy slot nie koliduje z żadną rezerwacją
    const hasCollision = bookedSlots.some((booked) =>
      isOverlapping(slot, serviceDuration, booked.time, booked.duration)
    )
    return !hasCollision
  })

  return available
}

/**
 * Sprawdza czy KONKRETNY slot (data + godzina) jest wolny
 * Używane przy zapisywaniu rezerwacji (POST)
 */
export async function isSlotAvailable(
  date: string,
  time: string,
  serviceDuration: number = 30,
  providerSlug?: string
): Promise<boolean> {
  const bookedSlots = await getBookedSlots(date, providerSlug)

  const hasCollision = bookedSlots.some((booked) =>
    isOverlapping(time, serviceDuration, booked.time, booked.duration)
  )

  return !hasCollision
}

/**
 * Walidacja rezerwacji przed zapisem
 */
export async function validateBooking(data: BookingCheck): Promise<{
  valid: boolean
  error?: string
}> {
  if (!data.date || !data.time) {
    return { valid: false, error: 'Brak daty lub godziny' }
  }

  const available = await isSlotAvailable(
    data.date,
    data.time,
    data.service_duration,
    data.provider_slug
  )

  if (!available) {
    return { valid: false, error: 'Ten termin został już zarezerwowany' }
  }

  return { valid: true }
}