import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date'); // Oczekiwany format: YYYY-MM-DD
  const serviceId = searchParams.get('serviceId');

  if (!dateStr) {
    return NextResponse.json({ error: 'Brak wybranej daty' }, { status: 400 });
  }

  try {
    // 1. Bezpieczne parsowanie daty (UTC) unikające przesunięć stref czasowych
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = dateObj.getUTCDay(); // 0 = Niedziela, 1 = Poniedziałek, ..., 6 = Sobota

    // 2. Pobranie godzin pracy z provider_availability dla wybranego dnia
    const { data: availability, error: availError } = await supabase
      .from('provider_availability')
      .select('*')
      .eq('day_of_week', dayOfWeek);

    if (availError || !availability || availability.length === 0) {
      return NextResponse.json([]); // Brak godzin pracy w ten dzień tygodnia
    }

    // 3. Pobranie czasu trwania usługi (w minutach)
    let durationMinutes = 30;
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

    // 4. Pobranie już zarezerwowanych terminów na ten dzień
    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time')
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`);

    const bookedTimes = (appointments || []).map((a: any) => {
      const d = new Date(a.start_time);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    // 5. Generowanie wolnych slotów co czas trwania usługi
    const slots: string[] = [];

    for (const rule of availability) {
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