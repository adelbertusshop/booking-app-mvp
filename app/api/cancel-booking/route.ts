export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBookingConfirmation } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentId, email } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: 'Brak ID rezerwacji.' }, { status: 400 });
    }

    // 1. Zmiana statusu wizyty
    const { data: appointment, error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .select('*')
      .single();

    if (updateError || !appointment) {
      console.error('[DATABASE ERROR]', updateError);
      return NextResponse.json({ error: 'Nie znaleziono wizyty w bazie.' }, { status: 404 });
    }

    // 2. Pobierz admin_email z salonu
    let adminEmail = 'wojciechjarosz41@gmail.com';
    if (appointment.salon_id) {
      const { data: salon } = await supabase
        .from('salons')
        .select('admin_email, salon_name')
        .eq('id', appointment.salon_id)
        .single();
      if (salon?.admin_email) adminEmail = salon.admin_email;
    }

    const targetEmail = email || appointment.client_email;
    const formattedDate = appointment.start_time ? appointment.start_time.split('T')[0] : 'Brak daty';
    const startTime = appointment.start_time ? appointment.start_time.split('T')[1]?.substring(0, 5) || '' : '';

    // 3. Email do klienta
    if (targetEmail) {
      try {
        await sendBookingConfirmation({
          to: targetEmail,
          clientName: appointment.client_name || 'Klient',
          serviceName: '[ANULOWANO WIZYTĘ]',
          date: formattedDate,
          startTime,
        });
      } catch (err) {
        console.error('Błąd e-mail klient:', err);
      }
    }

    // 4. Email do admina salonu
    try {
      await sendBookingConfirmation({
        to: adminEmail,
        clientName: appointment.client_name || 'Klient',
        serviceName: '[ODWOŁANO WIZYTĘ]',
        date: formattedDate,
        startTime,
      });
    } catch (err) {
      console.error('Błąd e-mail admin:', err);
    }

    return NextResponse.json({ success: true, message: 'Wizyta pomyślnie odwołana.' });
  } catch (error: any) {
    console.error('[API CANCEL CRASH]:', error);
    return NextResponse.json({ error: error.message || 'Błąd serwera.' }, { status: 500 });
  }
}
