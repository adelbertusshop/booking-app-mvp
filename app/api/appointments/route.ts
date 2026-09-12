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
    const { serviceName, date, time, clientName, email, phone, salonSlug } = body;

    // 1. Rozpoznawanie salonu po subdomenie/domenie lub ze sluga z body
    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0]; // np. 'qqq' z 'qqq.domain.com'

    // Szukamy salonu w bazie po slugu, subdomenie lub domenie
    const { data: salon, error: salonError } = await supabase
      .from('salons')
      .select('id, name, owner_email, slug')
      .or(`slug.eq.${salonSlug || subdomain},subdomain.eq.${subdomain},custom_domain.eq.${host}`)
      .single();

    if (salonError || !salon) {
      console.error('[SALON DETECT ERROR]: Nie znaleziono salonu dla podanej domeny/sluga', host);
      return NextResponse.json({ error: 'Nie znaleziono salonu dla tej rezerwacji.' }, { status: 404 });
    }

    const formattedDateStr = date ? date.trim() : '';
    const formattedTimeStr = time ? time.trim() : '10:00';

    let startDateTime = new Date(`${formattedDateStr}T${formattedTimeStr}:00`);
    if (isNaN(startDateTime.getTime())) {
      startDateTime = new Date();
    }

    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    // 2. Zapis do bazy Supabase z DYNAMICZNYM salon_id
    const { data: newBooking, error: dbError } = await supabase
      .from('appointments')
      .insert([
        {
          salon_id: salon.id, // <--- TUTAJ PRZYPISUJEMY REZERWACJĘ DO SALONU
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

    // 3. Powiadomienie do właściciela konkretnego salonu (pobranego z tabeli salons)
    if (salon.owner_email) {
      try {
        await sendBookingConfirmation({
          to: salon.owner_email,
          clientName: salon.name || 'Właściciel Salonu',
          serviceName: `[NOWA REZERWACJA] ${clientName || 'Klient'} - ${serviceName || 'Usługa'}`,
          date: formattedDate,
          startTime: startTimeFormatted,
        });
      } catch (err) {
        console.error('[EMAIL SALON OWNER ERROR]:', err);
      }
    }

    // 4. Wysyłka e-maila do Klienta
    if (email) {
      try {
        await sendBookingConfirmation({
          to: email,
          clientName: clientName || 'Klient',
          serviceName: serviceName || 'Usługa',
          date: formattedDate,
          startTime: startTimeFormatted,
        });
      } catch (err) {
        console.error('[EMAIL CLIENT ERROR]: Odrzucono e-mail klienta', err);
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
