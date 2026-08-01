import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = 'wojciechjarosz41@gmail.com';

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Brak ID rezerwacji.' }, { status: 400 });
    }

    // 1. Pobieramy dane rezerwacji przed jej anulowaniem
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json({ error: 'Nie znaleziono wizyty.' }, { status: 404 });
    }

    // 2. Zmiana statusu na 'cancelled' w Supabase
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      console.error('Błąd odwoływania wizyty:', updateError);
      return NextResponse.json({ error: 'Błąd bazy danych.' }, { status: 500 });
    }

    // Formatowanie daty i godziny
    const startDate = new Date(appointment.start_time);
    const formattedDate = startDate.toISOString().split('T')[0];
    const formattedTime = startDate.toTimeString().substring(0, 5);

    // 3. Wysyłka e-maili przez Resend
    try {
      const recipientEmail = process.env.NODE_ENV === 'production' ? appointment.client_email : ADMIN_EMAIL;

      // E-mail do KLIENTA
      await resend.emails.send({
        from: 'Rezerwacje <onboarding@resend.dev>',
        to: recipientEmail,
        subject: 'Wizyta została odwołana',
        html: `
          <h2>Informacja o odwołaniu wizyty</h2>
          <p>Witaj ${appointment.client_name},</p>
          <p>Twoja wizyta zaplanowana na <strong>${formattedDate}</strong> o godzinie <strong>${formattedTime}</strong> została odwołana.</p>
          <p>Przepraszamy za niedogodności.</p>
        `,
      });

      // E-mail do ADMINA
      await resend.emails.send({
        from: 'System Rezerwacji <onboarding@resend.dev>',
        to: ADMIN_EMAIL,
        subject: `❌ Anulowano wizytę: ${appointment.client_name}`,
        html: `
          <h2>Anulowano wizytę w systemie</h2>
          <p>Wizyta została pomyślnie odwołana w panelu admina:</p>
          <ul>
            <li><strong>Klient:</strong> ${appointment.client_name}</li>
            <li><strong>E-mail:</strong> ${appointment.client_email}</li>
            <li><strong>Data:</strong> ${formattedDate}</li>
            <li><strong>Godzina:</strong> ${formattedTime}</li>
          </ul>
        `,
      });
    } catch (emailErr) {
      console.error('Błąd wysyłania e-maila:', emailErr);
    }

    return NextResponse.json({ message: 'Wizyta została odwołana.' }, { status: 200 });
  } catch (error: any) {
    console.error('Błąd serwera:', error);
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}