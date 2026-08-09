import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { client_name, client_email, client_phone, start_time } = body;

    if (!client_name || !client_email || !client_phone || !start_time) {
      return NextResponse.json(
        { error: 'Brakujące wymagane pola formularza.' },
        { status: 400 }
      );
    }

    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const payload = {
      client_name,
      client_email,
      client_phone,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: 'confirmed',
      provider_id: 1,
      service_id: 1,
    };

    // 1. Zapis w Supabase
    const { data, error } = await supabase
      .from('appointments')
      .insert([payload])
      .select();

    if (error) {
      console.error('Supabase Error:', error);
      return NextResponse.json(
        { error: `Supabase: ${error.message} (${error.code || 'NO_CODE'})` },
        { status: 400 }
      );
    }

    // 2. Wysyłka maila przez Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const formattedDate = startDate.toLocaleDateString('pl-PL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const formattedTime = startDate.toLocaleTimeString('pl-PL', {
          hour: '2-digit',
          minute: '2-digit',
        });

        await resend.emails.send({
          from: 'Rezerwacje <onboarding@resend.dev>',
          to: [client_email],
          subject: 'Potwierdzenie rezerwacji',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2>Dziękujemy za rezerwację!</h2>
              <p>Cześć <strong>${client_name}</strong>,</p>
              <p>Twoja wizyta została zarejestrowana.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p><strong>Data:</strong> ${formattedDate}</p>
              <p><strong>Godzina:</strong> ${formattedTime}</p>
              <p><strong>Telefon:</strong> ${client_phone}</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Błąd Resend:', emailErr);
      }
    }

    return NextResponse.json({ success: true, appointment: data }, { status: 200 });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: `Błąd serwera API: ${err.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}