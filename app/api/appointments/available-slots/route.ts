import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Format: YYYY-MM-DD
    const providerId = searchParams.get('provider_id') || '1';

    if (!date) {
      return NextResponse.json({ error: 'Brak wymaganej daty' }, { status: 400 });
    }

    // 1. Zdefiniujmy domyślne godziny pracy (np. 09:00 - 17:00 co 1h)
    // W przyszłości można to pobierać dynamicznie z tabeli provider_availability
    const possibleSlots = [
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'
    ];

    // 2. Pobierzmy z bazy wszystkie rezerwacje dla tego dnia
    const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();

    const { data: bookedAppointments, error } = await supabase
      .from('appointments')
      .select('start_time')
      .eq('provider_id', providerId)
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay);

    if (error) {
      return NextResponse.json({ error: 'Błąd pobierania slotów' }, { status: 500 });
    }

    // Wyciągamy godziny zajętych terminów (np. ["11:00", "14:00"])
    const bookedTimes = bookedAppointments.map((app) => {
      const dateObj = new Date(app.start_time);
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    });

    // 3. Filtrujemy sloty – zostawiamy tylko te, które NIE są zajęte
    const availableSlots = possibleSlots.filter(
      (slot) => !bookedTimes.includes(slot)
    );

    return NextResponse.json({ slots: availableSlots }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}