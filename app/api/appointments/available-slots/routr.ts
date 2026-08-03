import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALL_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // YYYY-MM-DD

    if (!dateStr) {
      return NextResponse.json({ error: 'Brak podanej daty' }, { status: 400 });
    }

    // Pobieramy wizyty bez przeliczania na strefy czasowe – sprawdzamy przedział tekstowy
    const { data: bookedAppointments, error } = await supabase
      .from('appointments')
      .select('start_time')
      .neq('status', 'cancelled')
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Pobieramy zaplanowane godziny w formacie HH:MM
    const bookedTimes = (bookedAppointments || []).map((app) => {
      const parts = app.start_time.split('T');
      if (parts[1]) {
        return parts[1].substring(0, 5);
      }
      return '';
    });

    // Zostawiamy wolne sloty
    const availableSlots = ALL_SLOTS.filter((slot) => !bookedTimes.includes(slot));

    return NextResponse.json({ availableSlots, bookedTimes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}