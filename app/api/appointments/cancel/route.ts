import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Brak ID rezerwacji' }, { status: 400 });
    }

    // 1. Zmiana statusu w bazie Supabase
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const startDate = new Date(data.start_time);
    const dateFormatted = startDate.toISOString().split('T')[0];
    const timeFormatted = startDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

    // 2. Wysyłka maili przez Resend
    if (process.env.RESEND_API_KEY) {
      // Mail do Klienta
      if (data.client_email) {
        await resend.emails.send({
          from: 'Rezerwacje <onboarding@resend.dev>',
          to: data.client_email,
          subject: 'Wizyta została odwołana',
          html: `
            <div style="background-color: #121212; color: #ffffff; padding: 24px; font-family: sans-serif; border-radius: 8px;">
              <h2>Informacja o odwołaniu wizyty</h2>
              <p>Witaj <strong>${data.client_name}</strong>,</p>
              <p>Twoja wizyta zaplanowana na <strong>${dateFormatted}</strong> o godzinie <strong>${timeFormatted}</strong> została odwołana.</p>
              <p style="color: #a0a0a0;">Przepraszamy za niedogodności.</p>
            </div>
          `
        });
      }

      // Mail do Admina
      await resend.emails.send({
        from: 'System Rezerwacji <onboarding@resend.dev>',
        to: process.env.ADMIN_EMAIL || data.client_email,
        subject: `❌ Anulowano wizytę: ${data.client_name}`,
        html: `
          <div style="background-color: #121212; color: #ffffff; padding: 24px; font-family: sans-serif; border-radius: 8px;">
            <h2>Anulowano wizytę w systemie</h2>
            <p>Wizyta została pomyślnie odwołana w panelu admina:</p>
            <ul>
              <li><strong>Klient:</strong> ${data.client_name}</li>
              <li><strong>E-mail:</strong> ${data.client_email}</li>
              <li><strong>Data:</strong> ${dateFormatted}</li>
              <li><strong>Godzina:</strong> ${timeFormatted}</li>
            </ul>
          </div>
        `
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}