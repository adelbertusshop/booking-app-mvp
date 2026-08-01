import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { bookingSchema } from '@/lib/schemas/booking';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Twój adres e-mail administratora (na darmowym koncie Resend musi to być ten sam mail, na który założyłeś konto)
const ADMIN_EMAIL = 'wojciechjarosz41@gmail.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Walidacja danych
    const parseResult = bookingSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Nieprawidłowe dane.';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { firstName, lastName, email, phone, date, time } = parseResult.data;

    const startTime = new Date(`${date}T${time}:00.000Z`).toISOString();
    const endHour = parseInt(time.split(':')[0], 10) + 1;
    const endTime = new Date(`${date}T${String(endHour).padStart(2, '0')}:${time.split(':')[1]}:00.000Z`).toISOString();

    // 2. Sprawdzenie czy termin jest wolny
    const { data: existingAppointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('start_time', startTime)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existingAppointment) {
      return NextResponse.json(
        { error: 'Ten termin został właśnie zajęty. Wybierz inną godzinę.' },
        { status: 400 }
      );
    }

    // 3. Zapis w bazie Supabase
    const { data: newAppointment, error: insertError } = await supabase
      .from('appointments')
      .insert([
        {
          provider_id: 1,
          service_id: 1,
          client_name: `${firstName} ${lastName}`,
          client_email: email,
          client_phone: phone,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed',
        },
      ])
      .select();

    if (insertError) {
      console.error('Błąd zapisu rezerwacji:', insertError);
      return NextResponse.json(
        { error: `Błąd zapisu: ${insertError.message}` },
        { status: 500 }
      );
    }

   // 4. Wysyłka wiadomości e-mail do klienta i administratora
    try {
      // W środowisku produkcyjnym tu będzie `email`, ale na czas testów Resenda ślemy na Twój e-mail
      const recipientEmail = process.env.NODE_ENV === 'production' ? email : ADMIN_EMAIL;

      // Mail do KLIENTA
      await resend.emails.send({
        from: 'Rezerwacje <onboarding@resend.dev>',
        to: recipientEmail,
        subject: `Potwierdzenie rezerwacji wizyty dla ${firstName}`,
        html: `
          <h2>Dziękujemy za dokonanie rezerwacji, ${firstName}!</h2>
          <p>Twoja wizyta została pomyślnie zarezerwowana na adres: <strong>${email}</strong>.</p>
          <ul>
            <li><strong>Data:</strong> ${date}</li>
            <li><strong>Godzina:</strong> ${time}</li>
          </ul>
          <p>Do zobaczenia!</p>
        `,
      });

      // Mail do ADMINA
      await resend.emails.send({
        from: 'System Rezerwacji <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `🔔 Nowa rezerwacja: ${firstName} ${lastName}`,
        html: `
          <h2>Nowa rezerwacja w systemie!</h2>
          <p>Otrzymałeś nową rezerwację wizyty:</p>
          <ul>
            <li><strong>Klient:</strong> ${firstName} ${lastName}</li>
            <li><strong>E-mail klienta:</strong> ${email}</li>
            <li><strong>Telefon:</strong> ${phone}</li>
            <li><strong>Data:</strong> ${date}</li>
            <li><strong>Godzina:</strong> ${time}</li>
          </ul>
        `,
      });
    } catch (emailErr) {
      console.error('Błąd wysyłania e-maila:', emailErr);
    }

    return NextResponse.json(
      { message: 'Rezerwacja zakończona sukcesem!', appointment: newAppointment },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Błąd serwera:', error);
    return NextResponse.json(
      { error: 'Wystąpił nieoczekiwany błąd serwera.' },
      { status: 500 }
    );
  }
}

