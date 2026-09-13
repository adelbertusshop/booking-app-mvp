import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, clientName, email, phone, salonSlug, salonId, serviceId, providerId } = body;

    const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    let targetSalonId: string | null = null;

    // 1. Jeśli to poprawny UUID
    if (isUuid(salonId)) {
      targetSalonId = salonId;
    } else {
      const searchValue = salonSlug || (typeof salonId === 'string' ? salonId : null);

      if (searchValue) {
        const cleanSearch = searchValue.trim();

        // Szukamy po slug lub name
        const { data: salon } = await supabase
          .from('salons')
          .select('id')
          .or(`slug.ilike.${cleanSearch},name.ilike.${cleanSearch}`)
          .maybeSingle();

        if (salon) {
          targetSalonId = salon.id;
        }
      }
    }

    // 2. AWARYJNIE: Jeśli nadal brak ID, pobieramy pierwszy dowolny salon z bazy
    if (!targetSalonId) {
      const { data: fallbackSalon } = await supabase
        .from('salons')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (fallbackSalon) {
        targetSalonId = fallbackSalon.id;
      }
    }

    // 3. Jeśli baza salonów jest całkowicie pusta
    if (!targetSalonId) {
      return NextResponse.json(
        { error: 'Brak salonów w bazie danych. Utwórz najpierw salon w panelu.' },
        { status: 400 }
      );
    }

    // Przygotowanie daty i godziny (+1h)
    const startDateObj = new Date(`${date}T${time}:00`);
    const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000);

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    // Zapis rezerwacji
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([
        {
          salon_id: targetSalonId,
          start_time: startIso,
          end_time: endIso,
          client_name: clientName,
          client_phone: phone,
          status: 'confirmed',
          provider_id: providerId || 1,
          service_id: serviceId || 1,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
