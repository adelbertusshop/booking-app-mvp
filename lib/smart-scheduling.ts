import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

interface GenerateSlotsParams {
  providerId: number | string;
  serviceId: number | string;
  date: string;
}

export async function getAvailableSlots({
  providerId,
  serviceId,
  date,
}: GenerateSlotsParams): Promise<TimeSlot[]> {
  // 1. Pobranie usługi
  const { data: services, error: serviceErr } = await supabase
    .from('services')
    .select('duration_minutes, buffer_minutes')
    .eq('id', Number(serviceId));

  const service = services?.[0];

  if (serviceErr || !service) {
    console.error('BŁĄD SUPABASE SERVICES:', serviceErr);
    throw new Error('Usługa nie istnieje lub błąd pobierania');
  }

  const duration = service.duration_minutes;
  const buffer = service.buffer_minutes || 0;
  const totalSlotDuration = duration + buffer;

  // 2. Pobranie dostępności pracownika (bezpieczny parsing daty bez przesunięcia UTC)
  const [year, month, day] = date.split('-').map(Number);
  const dayOfWeek = new Date(year, month - 1, day).getDay();

  const { data: availabilities, error: availErr } = await supabase
    .from('provider_availability')
    .select('start_time, end_time, is_working_day')
    .eq('provider_id', Number(providerId))
    .eq('day_of_week', dayOfWeek);

  const availability = availabilities?.[0];

  if (availErr || !availability || !availability.is_working_day) {
    console.log('Brak dostępności w tym dniu lub dzień wolny.');
    return [];
  }

  // 3. Pobranie rezerwacji z danego dnia (w ISO / UTC)
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const { data: appointments, error: appErr } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('provider_id', Number(providerId))
    .neq('status', 'cancelled')
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay);

  if (appErr) {
    console.error('BŁĄD APPOINTMENTS:', appErr);
    throw new Error('Błąd pobierania istniejących rezerwacji');
  }

  // 4. Generowanie wolnych slotów (sztywna spójność strefy UTC)
  const slots: TimeSlot[] = [];
  
  const startTimeFormatted = availability.start_time.length === 5 ? `${availability.start_time}:00` : availability.start_time;
  const endTimeFormatted = availability.end_time.length === 5 ? `${availability.end_time}:00` : availability.end_time;

  // Dodanie sufixu 'Z' wymusza traktowanie godzin z bazy jako UTC
  const workStart = new Date(`${date}T${startTimeFormatted}Z`);
  const workEnd = new Date(`${date}T${endTimeFormatted}Z`);

  let currentSlotStart = new Date(workStart);

  while (
    new Date(currentSlotStart.getTime() + duration * 60000) <= workEnd
  ) {
    const currentSlotEnd = new Date(currentSlotStart.getTime() + duration * 60000);
    const slotWithBufferEnd = new Date(currentSlotStart.getTime() + totalSlotDuration * 60000);

    const hasOverlap = (appointments || []).some((app) => {
      const appStart = new Date(app.start_time).getTime();
      const appEnd = new Date(app.end_time).getTime();
      const slotStart = currentSlotStart.getTime();
      const slotEnd = slotWithBufferEnd.getTime();

      return slotStart < appEnd && slotEnd > appStart;
    });

    slots.push({
      startTime: currentSlotStart.toISOString(),
      endTime: currentSlotEnd.toISOString(),
      available: !hasOverlap,
    });

    currentSlotStart = slotWithBufferEnd;
  }

  console.log('Wygenerowane sloty z bazy:', slots);
  return slots;
}

