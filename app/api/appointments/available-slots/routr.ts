import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Definiujemy godziny otwarcia (np. od 09:00 do 17:00 co godzinę)
const ALL_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // Oczekujemy formatu YYYY-MM-DD

    if (!dateStr) {
      return NextResponse.json({ error: 'Brak podanej daty' }, { status: 400 });
    }

    // Zakres całego dnia: od 00:00:00 do 23:59:59
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;

    // Pobieramy tylko aktywne rezerwacje dla danego dnia
    const { data: bookedAppointments, error } = await supabase
      .from('appointments')
      .select('start_time')
      .neq('status', 'cancelled')
      .gte('start_time', startOfDay)
      .lte('start_time', endOfDay);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Wyciągamy zajęte godziny w formacie HH:MM
    const bookedTimes = bookedAppointments.map((app) => {
      const date = new Date(app.start_time);
      return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    });

    // Filtrujemy sloty – zostawiamy tylko te, które nie są zajęte
    const availableSlots = ALL_SLOTS.filter((slot) => !bookedTimes.includes(slot));

    return NextResponse.json({ availableSlots, bookedTimes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}