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

    // 1. Zmiana statusu wizyty w Supabase bez wymuszania relacji ze starymi danymi
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

    const targetEmail = email || appointment.client_email || 'wojciechjarosz41@gmail.com';
    const formattedDate = appointment.start_time ? appointment.start_time.split('T')[0] : 'Brak daty';
    const startTime = appointment.start_time ? appointment.start_time.split('T')[1] || appointment.start_time : '';

    // 2. Bezpieczna wysyłka do Klienta
    try {
      await sendBookingConfirmation({
        to: targetEmail,
        clientName: appointment.client_name || 'Klient',
        serviceName: '[ANULOWANO WIZYTĘ]',
        date: formattedDate,
        startTime: startTime,
      });
    } catch (err) {
      console.error('Błąd e-mail klient:', err);
    }

    // 3. Bezpieczna wysyłka do Admina
    try {
      await sendBookingConfirmation({
        to: 'wojciechjarosz41@gmail.com',
        clientName: 'Administrator',
        serviceName: `[ODWOŁANO WIZYTĘ] ${appointment.client_name || 'Klient'}`,
        date: formattedDate,
        startTime: startTime,
      });
    } catch (err) {
      console.error('Błąd e-mail admin:', err);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Wizyta pomyślnie odwołana.' 
    });
  } catch (error: any) {
    console.error('[API CANCEL CRASH]:', error);
    return NextResponse.json(
      { error: error.message || 'Błąd serwera.' },
      { status: 500 }
    );
  }
}