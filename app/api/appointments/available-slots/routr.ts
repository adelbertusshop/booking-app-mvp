import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALL_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // Oczekiwany format: YYYY-MM-DD

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Nieprawidłowy format daty' }, { status: 400 });
    }

    // Zakres wyszukiwania na całą dobę (od początku do końca wybranego dnia)
    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;

    // Pobieramy rezerwacje dla danego dnia
    const { data: bookedAppointments, error } = await supabase
      .from('appointments')
      .select('start_time, status')
      .neq('status', 'cancelled')
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`);

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Wyciągamy zajęte godziny w formacie HH:MM
    const bookedTimes = (bookedAppointments || []).map((app) => {
      // Obsługa formatów 'YYYY-MM-DDTHH:mm:ss' oraz 'YYYY-MM-DD HH:mm:ss'
      const timePart = app.start_time.includes('T') 
        ? app.start_time.split('T')[1] 
        : app.start_time.split(' ')[1];
      
      return timePart ? timePart.substring(0, 5) : '';
    });

    // Filtrujemy dostępne sloty
    const availableSlots = ALL_SLOTS.filter((slot) => !bookedTimes.includes(slot));

    return NextResponse.json({ availableSlots, bookedTimes });
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}