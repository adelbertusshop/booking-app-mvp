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
    const { serviceName, date, time, clientName, email, phone } = body;

    const formattedDateStr = date ? date.trim() : '';
    const formattedTimeStr = time ? time.trim() : '10:00';

    let startDateTime = new Date(`${formattedDateStr}T${formattedTimeStr}:00`);
    if (isNaN(startDateTime.getTime())) {
      startDateTime = new Date();
    }

    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    // 1. Zapis do bazy Supabase
    const { data: newBooking, error: dbError } = await supabase
      .from('appointments')
      .insert([
        {
          service_id: 1,
          client_name: clientName || 'Klient',
          client_email: email || '',
          client_phone: phone || '',
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed'
        }
      ])
      .select('*')
      .single();

    if (dbError || !newBooking) {
      console.error('[DATABASE INSERT ERROR]:', dbError);
      return NextResponse.json({ error: dbError?.message || 'Błąd zapisu w bazie' }, { status: 400 });
    }

    const formattedDate = newBooking.start_time ? newBooking.start_time.split('T')[0] : formattedDateStr;
    const startTimeFormatted = newBooking.start_time ? (newBooking.start_time.split('T')[1] || formattedTimeStr) : formattedTimeStr;

    // 2. Gwarantowana wysyłka do Admina (Zawsze przechodzi)
    try {
      await sendBookingConfirmation({
        to: 'wojciechjarosz41@gmail.com',
        clientName: 'Administrator',
        serviceName: `[NOWA REZERWACJA] ${clientName || 'Klient'} - ${serviceName || 'Konsultacja'}`,
        date: formattedDate,
        startTime: startTimeFormatted,
      });
    } catch (err) {
      console.error('[EMAIL ADMIN ERROR]:', err);
    }

    // 3. Bezpieczna wysyłka do Klienta w bloku try/catch (błąd klienta nie przerywa działania)
    if (email) {
      try {
        await sendBookingConfirmation({
          to: email,
          clientName: clientName || 'Klient',
          serviceName: serviceName || 'Konsultacja',
          date: formattedDate,
          startTime: startTimeFormatted,
        });
      } catch (err) {
        console.error('[EMAIL CLIENT ERROR]: Odrzucono e-mail klienta (darmowy plan Resend)', err);
      }
    }

    return NextResponse.json({ success: true, booking: newBooking }, { status: 200 });
  } catch (err: any) {
    console.error('[CRITICAL BOOKING ERROR]:', err);
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Brak ID rezerwacji' }, { status: 400 });
    }

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DELETE ERROR]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}