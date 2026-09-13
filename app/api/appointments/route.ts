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

    let targetSalonId = salonId || null;

    // Poprawka: Jeśli salonId nie jest w formacie UUID (np. przesłano "qqq"), czyścimy go i traktujemy jako slug
    const isUuid = targetSalonId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetSalonId);
    
    if (!isUuid) {
      // Jeśli salonId nie jest UUID, sprawdźmy czy to slug
      const slugToUse = salonSlug || targetSalonId;
      targetSalonId = null;

      if (slugToUse) {
        const { data: salon } = await supabase
          .from('salons')
          .select('id')
          .ilike('slug', slugToUse)
          .single();
        
        if (salon) targetSalonId = salon.id;
      }
    }

    // Jeśli brak ID salonu – odrzucamy próbę zapisania do losowego salonu
    if (!targetSalonId) {
      return NextResponse.json(
        { error: 'Brak identyfikatora salonu. Rezerwacja odrzucona.' },
        { status: 400 }
      );
    }

    // 2. Przygotowujemy start_time oraz end_time (+1 godzina)
    const startDateObj = new Date(`${date}T${time}:00`);
    const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000);

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    // 3. Zapis do bazy przypisany do WŁAŚCIWEGO salonu
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
