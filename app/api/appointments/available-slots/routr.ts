import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALL_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');

    // Jeśli brak daty, zwracamy domyślny zestaw godzin
    if (!dateStr) {
      return NextResponse.json({ availableSlots: ALL_SLOTS });
    }

    // Odpytujemy Supabase
    const { data: bookedAppointments, error } = await supabase
      .from('appointments')
      .select('start_time, status');

    // W razie błędu Supabase (np. brak RLS/uprawnień) NIE blokujemy formularza – dajemy wolne sloty
    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ 
        availableSlots: ALL_SLOTS, 
        warning: `Błąd bazy: ${error.message}` 
      });
    }

    // Filtrujemy zajęte godziny dla danego dnia
    const bookedTimes = (bookedAppointments || [])
      .filter((app) => app.status !== 'cancelled' && app.start_time && String(app.start_time).startsWith(dateStr))
      .map((app) => {
        const str = String(app.start_time);
        const timePart = str.includes('T') ? str.split('T')[1] : str.split(' ')[1];
        return timePart ? timePart.substring(0, 5) : '';
      });

    const availableSlots = ALL_SLOTS.filter((slot) => !bookedTimes.includes(slot));

    return NextResponse.json({ 
      availableSlots: availableSlots.length > 0 ? availableSlots : ALL_SLOTS, 
      bookedTimes 
    });
  } catch (err: any) {
    // Awaryjny fallback serwera
    return NextResponse.json({ 
      availableSlots: ALL_SLOTS, 
      warning: err.message 
    });
  }
}