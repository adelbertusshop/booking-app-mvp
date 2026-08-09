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
      return NextResponse.json({ error: 'Brak daty' }, { status: 400 });
    }

    // Pobieramy WSZYSTKIE wizyty, które nie są anulowane
    const { data: allAppointments, error } = await supabase
      .from('appointments')
      .select('start_time, status')
      .neq('status', 'cancelled');

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: `Błąd Supabase: ${error.message}` }, { status: 500 });
    }

    // Wyciągamy zajęte godziny dla DOKŁADNIE wybranego dnia w JavaScript
    const bookedTimes: string[] = [];

    (allAppointments || []).forEach((app) => {
      if (!app.start_time) return;
      
      // app.start_time wygląda zazwyczaj tak: "2026-08-03T10:00:00" lub "2026-08-03 10:00:00"
      const str = String(app.start_time);
      if (str.startsWith(dateStr)) {
        // Data się zgadza, wyciągamy godzinę HH:MM
        const timePart = str.includes('T') ? str.split('T')[1] : str.split(' ')[1];
        if (timePart) {
          bookedTimes.push(timePart.substring(0, 5));
        }
      }
    });

    // Filtrujemy wolne sloty
    const availableSlots = ALL_SLOTS.filter((slot) => !bookedTimes.includes(slot));

    return NextResponse.json({ 
      availableSlots, 
      bookedTimes,
      totalBookings: allAppointments?.length || 0 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}