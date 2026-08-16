import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const serviceId = searchParams.get('serviceId');

  if (!date) {
    return NextResponse.json({ error: 'Brak wybranej daty' }, { status: 400 });
  }

  try {
    let query = supabase
      .from('provider_availability')
      .select('*')
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`);

    if (serviceId) {
      query = query.eq('service_id', Number(serviceId));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Wyciągamy same godziny w formacie "HH:MM" ze zwróconych rekordów
    const slots = (data || []).map((item: any) => {
      const time = new Date(item.start_time);
      return time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    });

    return NextResponse.json(slots);
  } catch (err) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}