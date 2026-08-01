import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAvailableSlots } from '@/lib/smart-scheduling';
import { sendBookingConfirmation } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, serviceId, customerData, startTime, date } = body;

    if (!providerId || !serviceId || !startTime || !date || !customerData?.email) {
      return NextResponse.json(
        { error: 'Brak wymaganych danych do rezerwacji.' },
        { status: 400 }
      );
    }

    // Walidacja dostępności slotu przed zapisem
    const availableSlots = await getAvailableSlots({ providerId, serviceId, date });
    const isSlotAvailable = availableSlots.some(
      (slot) => slot.startTime === startTime && slot.available === true
    );

    if (!isSlotAvailable) {
      return NextResponse.json(
        { error: 'Ten termin jest już zajęty.' },
        { status: 409 }
      );
    }

    // Pobranie danych usługi
    const { data: service } = await supabase
      .from('services')
      .select('name, duration_minutes')
      .eq('id', serviceId)
      .single();

    if (!service) {
      return NextResponse.json({ error: 'Usługa nie istnieje.' }, { status: 404 });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + service.duration_minutes * 60000);

    // Zapis rezerwacji w Supabase
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert([
        {
          provider_id: providerId,
          service_id: serviceId,
          client_name: `${customerData.firstName} ${customerData.lastName}`,
          client_email: customerData.email,
          client_phone: customerData.phone,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: 'confirmed',
        },
      ])
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Wysyłka e-maila z potwierdzeniem (nie blokuje odpowiedzi w przypadku błędu poczty)
    await sendBookingConfirmation({
      to: customerData.email,
      clientName: customerData.firstName,
      serviceName: service.name,
      date: date,
      startTime: startTime,
    });

    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Błąd podczas tworzenia rezerwacji.' },
      { status: 500 }
    );
  }
}