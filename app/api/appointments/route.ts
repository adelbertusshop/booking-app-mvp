import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, clientName, email, phone, salonSlug, serviceId, providerId } = body;

    // 1. Pobieramy właściwy salon_id z bazy
    let targetSalonId = null;

    if (salonSlug) {
      const { data: salon } = await supabase
        .from('salons')
        .select('id')
        .eq('slug', salonSlug)
        .single();
      
      if (salon) targetSalonId = salon.id;
    }

    // Fallback: pobieramy pierwszy istniejący salon (dla testów)
    if (!targetSalonId) {
      const { data: defaultSalon } = await supabase
        .from('salons')
        .select('id')
        .limit(1)
        .single();

      if (defaultSalon) targetSalonId = defaultSalon.id;
    }

    if (!targetSalonId) {
      return NextResponse.json(
        { error: 'Nie znaleziono salonu dla tej rezerwacji.' },
        { status: 400 }
      );
    }

    // 2. Przygotowujemy start_time oraz end_time (+1 godzina)
    const startDateObj = new Date(`${date}T${time}:00`);
    const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000);

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    // 3. Zapis do bazy uwzględniający pole status
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([
        {
          salon_id: targetSalonId,
          start_time: startIso,
          end_time: endIso,
          client_name: clientName,
          client_phone: phone,
          status: 'confirmed', // Dodajemy wymagany status
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
