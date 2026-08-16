import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const serviceId = searchParams.get('serviceId');

  if (!dateStr) {
    return NextResponse.json({ error: 'Brak wybranej daty' }, { status: 400 });
  }

  try {
    // 1. Obliczenie dnia tygodnia dla podanej daty (0 = Niedziela, 1 = Poniedziałek, ..., 3 = Środa)
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();

    // 2. Pobranie godzin pracy z provider_availability dla tego dnia tygodnia
    const { data: availability, error: availError } = await supabase
      .from('provider_availability')
      .select('*')
      .eq('day_of_week', dayOfWeek);

    if (availError || !availability || availability.length === 0) {
      return NextResponse.json([]); // Brak godzin pracy w ten dzień tygodnia
    }

    // 3. Pobranie czasu trwania usługi (w minutach) z tabeli services
    let durationMinutes = 30; // Domyślny czas
    if (serviceId) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', Number(serviceId))
        .single();

      if (service?.duration_minutes) {
        durationMinutes = service.duration_minutes;
      }
    }

    // 4. Pobranie już istniejących rezerwacji dla tej daty
    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time')
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`);

    const bookedTimes = (appointments || []).map((a: any) => {
      const d = new Date(a.start_time);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    // 5. Generowanie dostępnych slotów (od start_time do end_time)
    const slots: string[] = [];

    for (const rule of availability) {
      const [startH, startM] = rule.start_time.split(':').map(Number);
      const [endH, endM] = rule.end_time.split(':').map(Number);

      let current = new Date(dateObj);
      current.setHours(startH, startM, 0, 0);

      const end = new Date(dateObj);
      end.setHours(endH, endM, 0, 0);

      while (current < end) {
        const timeString = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;

        // Jeśli godzina nie jest zajęta, dodaj do listy dostępnych
        if (!bookedTimes.includes(timeString)) {
          slots.push(timeString);
        }

        // Przesuń czas o długość wybranej usługi
        current = new Date(current.getTime() + durationMinutes * 60000);
      }
    }

    return NextResponse.json(slots);
  } catch (err) {
    console.error('Błąd generowania slotów:', err);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}