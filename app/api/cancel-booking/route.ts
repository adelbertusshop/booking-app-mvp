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

    const providedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!providedEmail) {
      return NextResponse.json({ error: 'Podaj adres e-mail rezerwacji.' }, { status: 400 });
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

    const { data: appointment, error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .eq('client_email', existingAppointment.client_email)
      .select('*')
      .single();

    if (updateError || !appointment) {
      console.error('[DATABASE ERROR]', updateError);
      return NextResponse.json({ error: 'Nie udało się odwołać wizyty.' }, { status: 409 });
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
    const msg = error instanceof Error ? error.message : 'Błąd serwera.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
