import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, service, date, time } = body;

    const startIso = date && time ? new Date(`${date}T${time}:00Z`).toISOString() : new Date().toISOString();
    const endIso = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();

    // Wpisujemy dokładnie 'spotkania' (zwykłe 'a' na końcu)
    const { data, error } = await supabase
      .from('spotkania')
      .insert([
        {
          identyfikator_dostawcy: 1,
          identyfikator_usługi: service ? Number(service) : 1,
          'czas_rozpoczęcia': startIso,
          'czas_końcowy': endIso,
          status: 'potwierdzony',
          'adres_e-mail_klienta': email,
          nazwa_klienta: name,
          telefon_klienta: phone,
        }
      ])
      .select();

    if (error) {
      console.error('Błąd Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (process.env.RESEND_API_KEY && email) {
      try {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Potwierdzenie rezerwacji',
          html: `<p>Cześć <strong>${name}</strong>,</p><p>Twoja rezerwacja została pomyślnie złożona!</p>`
        });
      } catch (e) {
        console.error('Błąd wysyłki Resend:', e);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Błąd serwera:', err);
    return NextResponse.json({ error: err.message || 'Błąd serwera' }, { status: 500 });
  }
}