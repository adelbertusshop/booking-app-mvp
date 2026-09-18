export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, clientName, email, phone, salonId, serviceId, providerId } = body;

    if (!salonId) {
      return NextResponse.json(
        { error: 'Brak identyfikatora salonu (salonId).' },
        { status: 400 }
      );
    }

    const startDateObj = new Date(`${date}T${time}:00`);
    const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000);

    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([
        {
          salon_id: salonId,
          start_time: startIso,
          end_time: endIso,
          client_name: clientName,
          email: email,
          client_phone: phone,
          status: 'confirmed',
          provider_id: providerId || 1,
          service_id: serviceId || 1,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    try {
      if (email && process.env.RESEND_API_KEY) {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Potwierdzenie rezerwacji wizyty',
          html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
              <h2>Potwierdzenie rezerwacji</h2>
              <p>Witaj <strong>${clientName}</strong>,</p>
              <p>Twoja wizyta została pomyślnie zarezerwowana.</p>
              <p><strong>Termin:</strong> ${date} o godzinie ${time}</p>
              <p>Dziękujemy za skorzystanie z naszych usług!</p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error('Błąd wysyłki e-maila przez Resend:', emailErr);
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
