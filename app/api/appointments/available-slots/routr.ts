import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALL_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // np. "2026-08-03"

    if (!dateStr) {
      return NextResponse.json({ error: 'Brak podanej daty' }, { status: 400 });
    }

    // Pobieramy rezerwacje, których start_time zaczyna się od wybranej daty (YYYY-MM-DD)
    const { data: bookedAppointments, error } = await supabase
      .from('appointments')
      .select('start_time')
      .neq('status', 'cancelled')
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Wyciągamy zajęte godziny w formacie HH:MM
    const bookedTimes = (bookedAppointments || []).map((app) => {
      // Wyciągamy bezpośrednio ciąg znaków godziny (np. z "2026-08-03T14:00:00" robimy "14:00")
      const timePart = app.start_time.split('T')[1];
      return timePart ? timePart.substring(0, 5) : '';
    });

    // Filtrujemy wolne sloty
    const availableSlots = ALL_SLOTS.filter((slot) => !bookedTimes.includes(slot));

    return NextResponse.json({ availableSlots, bookedTimes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}