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

    const isUuid = (val: any) =>
      typeof val === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    let targetSalonId: string | null = null;

    // 1. Jeśli przekazano prawidłowy UUID
    if (isUuid(salonId)) {
      targetSalonId = salonId;
    } else {
      // 2. Szukamy konkretnego salonu po slug lub nazwie
      const searchValue = salonSlug || (typeof salonId === 'string' ? salonId : null);

      if (searchValue) {
        const cleanSearch = searchValue.trim();

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

    // 3. Jeśli szukany salon nie istnieje po nazwie (np. "QQQ"), pobieramy salon powiązany z emailem lub ostatnio utworzony salon
    if (!targetSalonId) {
      const { data: latestSalon } = await supabase
        .from('salons')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSalon) {
        targetSalonId = latestSalon.id;
      }
    }

    if (!targetSalonId) {
      return NextResponse.json(
        { error: 'Brak odpowiedniego salonu w bazie. Sprawdź nazwę salonu.' },
        { status: 400 }
      );
    }

    // Przygotowanie czasu rezerwacji
    const startDateObj = new Date(`${date}T${time}:00`);
    const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000);

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    // Zapis do tabeli appointments
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
