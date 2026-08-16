import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date'); // Format: YYYY-MM-DD
  const serviceId = searchParams.get('serviceId');

  if (!dateStr) {
    return NextResponse.json({ error: 'Brak wybranej daty' }, { status: 400 });
  }

  try {
    // 1. Parsowanie daty YYYY-MM-DD lub MM/DD/YYYY
    let year: number, month: number, day: number;

    if (dateStr.includes('-')) {
      [year, month, day] = dateStr.split('-').map(Number);
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/').map(Number);
      if (parts[0] > 12) {
        // DD/MM/YYYY
        [day, month, year] = parts;
      } else {
        // MM/DD/YYYY
        [month, day, year] = parts;
      }
    } else {
      const d = new Date(dateStr);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }

    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Niedziela, 1 = Poniedziałek, ..., 6 = Sobota

    // 2. Pobranie godzin pracy z provider_availability
    const { data: availability, error: availError } = await supabase
      .from('provider_availability')
      .select('*')
      .eq('day_of_week', dayOfWeek);

    // Domyślne godziny (8:00 - 18:00), jeśli w bazie nie ma zdefiniowanego dnia
    let rules = availability && availability.length > 0 
      ? availability 
      : [{ start_time: '08:00:00', end_time: '18:00:00' }];

    // 3. Czas trwania usługi
    let durationMinutes = 90; // Domyślnie 90 min (dla rzęs)
    if (serviceId) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', Number(serviceId))
        .maybeSingle();

      if (service?.duration_minutes) {
        durationMinutes = service.duration_minutes;
      }
    }

    // 4. Pobranie zarezerwowanych wizyt
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time')
      .gte('start_time', `${formattedDate}T00:00:00`)
      .lte('start_time', `${formattedDate}T23:59:59`);

    const bookedTimes = (appointments || []).map((a: any) => {
      const d = new Date(a.start_time);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    // 5. Generowanie slotów
    const slots: string[] = [];

    for (const rule of rules) {
      const [startH, startM] = rule.start_time.split(':').map(Number);
      const [endH, endM] = rule.end_time.split(':').map(Number);

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (currentMinutes + durationMinutes <= endMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

        if (!bookedTimes.includes(timeString)) {
          slots.push(timeString);
        }

        currentMinutes += durationMinutes;
      }
    }

    return NextResponse.json(slots);
  } catch (err) {
    console.error('Błąd generowania slotów:', err);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}