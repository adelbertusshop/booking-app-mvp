import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { serviceName, date, time, clientName, email, phone, salonSlug } = body;

    // 1. Pobieramy ID salonu na podstawie slugu
    let targetSalonId = null;

    if (salonSlug) {
      const { data: salon } = await supabase
        .from('salons')
        .select('id')
        .eq('slug', salonSlug)
        .single();
      
      if (salon) targetSalonId = salon.id;
    }

    // Fallback: pobieramy pierwszy istniejący salon
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

    // 2. Zapis do bazy z dopasowanymi nazwami kolumn (date, time, service)
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([
        {
          salon_id: targetSalonId,
          service: serviceName,
          date: date,
          time: time,
          client_name: clientName,
          client_email: email,
          client_phone: phone,
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
