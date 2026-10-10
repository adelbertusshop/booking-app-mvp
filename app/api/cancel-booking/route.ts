export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBookingConfirmation } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentId, email } = body;

    if (typeof appointmentId !== 'string' || !UUID_RE.test(appointmentId)) {
      return NextResponse.json({ error: 'Nieprawidłowe ID rezerwacji.' }, { status: 400 });
    }

    const providedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!providedEmail || providedEmail.length > 254 || !EMAIL_RE.test(providedEmail)) {
      return NextResponse.json({ error: 'Podaj prawidłowy adres e-mail rezerwacji.' }, { status: 400 });
    }

    // 1. Pobierz wizytę i zweryfikuj e-mail przed zmianą statusu.
    // Dzięki temu samo zgadnięcie ID rezerwacji nie pozwala jej odwołać.
    const { data: existingAppointment, error: lookupError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (lookupError || !existingAppointment) {
      console.error('[DATABASE ERROR]', lookupError);
      return NextResponse.json({ error: 'Nie znaleziono wizyty w bazie.' }, { status: 404 });
    }

    const storedEmail = typeof existingAppointment.client_email === 'string'
      ? existingAppointment.client_email.trim().toLowerCase()
      : '';

    if (!storedEmail || storedEmail !== providedEmail) {
      return NextResponse.json({ error: 'Dane rezerwacji są nieprawidłowe.' }, { status: 403 });
    }

    if (existingAppointment.status === 'cancelled') {
      return NextResponse.json({ error: 'Ta wizyta została już odwołana.' }, { status: 409 });
    }

    // Atomowa część anulowania: drugie równoczesne żądanie nie może ponownie
    // zmienić już anulowanej wizyty ani wysłać kolejnego potwierdzenia.
    const { data: appointment, error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .eq('client_email', existingAppointment.client_email)
      .neq('status', 'cancelled')
      .select('*')
      .maybeSingle();

    if (updateError) {
      console.error('[DATABASE ERROR]', updateError);
      return NextResponse.json({ error: 'Nie udało się odwołać wizyty.' }, { status: 409 });
    }

    if (!appointment) {
      return NextResponse.json({ error: 'Ta wizyta została już odwołana lub nie jest już dostępna.' }, { status: 409 });
    }

    // 2. Pobierz admin_email z salonu
    let adminEmail: string | null = null;
    if (appointment.salon_id) {
      const { data: salon } = await supabase
        .from('salons')
        .select('admin_email, salon_name')
        .eq('id', appointment.salon_id)
        .single();
      if (salon?.admin_email) {
        adminEmail = salon.admin_email;
      } else {
        console.error('[CANCEL EMAIL] Brak admin_email dla salon_id:', appointment.salon_id, '— pomijam wysyłkę do admina.');
      }
    } else {
      console.error('[CANCEL EMAIL] Brak salon_id w rezerwacji ID:', appointmentId, '— pomijam wysyłkę do admina.');
    }

    const targetEmail = appointment.client_email;
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

    // 4. Email do admina salonu — tylko jeśli mamy poprawny adres z bazy
    if (adminEmail) {
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
    } else {
      console.warn('[CANCEL EMAIL] Pominięto email do admina — brak adresu w bazie.');
    }

    return NextResponse.json({ success: true, message: 'Wizyta pomyślnie odwołana.' });
  } catch (error: unknown) {
    console.error('[API CANCEL CRASH]:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera. Spróbuj ponownie.' }, { status: 500 });
  }
}
