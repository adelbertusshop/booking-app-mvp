export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get('salonId');
    const date = searchParams.get('date');

    if (!salonId || !date) {
      return NextResponse.json({ error: 'Brak salonId lub date' }, { status: 400 });
    }

    // Pobierz zajęte sloty na dany dzień dla tego salonu
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;

    const { data: booked, error } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('salon_id', salonId)
      .neq('status', 'cancelled')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bookedTimes = (booked || []).map((a) => ({
      start: a.start_time?.split('T')[1]?.substring(0, 5) || '',
      end: a.end_time?.split('T')[1]?.substring(0, 5) || '',
    }));

    return NextResponse.json({ bookedTimes });
  } catch (err) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, clientName, email, phone, salonId, serviceId } = body;

    if (!salonId) {
      return NextResponse.json({ error: 'Brak identyfikatora salonu (salonId).' }, { status: 400 });
    }
    if (!date || !time) {
      return NextResponse.json({ error: 'Brak daty lub godziny.' }, { status: 400 });
    }

    // Pobierz czas trwania usługi
    let durationMinutes = 60;
    if (serviceId) {
      const { data: svc } = await supabase
        .from('services')
        .select('duration_minutes, name')
        .eq('id', serviceId)
        .single();
      if (svc?.duration_minutes) durationMinutes = svc.duration_minutes;
    }

    const startDateObj = new Date(`${date}T${time}:00`);
    const endDateObj = new Date(startDateObj.getTime() + durationMinutes * 60 * 1000);
    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    // Sprawdź czy slot jest wolny
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('salon_id', salonId)
      .neq('status', 'cancelled')
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .limit(1);

    if (conflict && conflict.length > 0) {
      return NextResponse.json(
        { error: 'Ten termin jest już zajęty. Wybierz inną godzinę.' },
        { status: 409 }
      );
    }

    // Zapis do bazy
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([{
        salon_id: salonId,
        start_time: startIso,
        end_time: endIso,
        client_name: clientName,
        client_email: email,
        client_phone: phone,
        status: 'confirmed',
        service_id: serviceId || null,
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Pobierz nazwę usługi do emaila
    let serviceName = 'Wizyta';
    if (serviceId) {
      const { data: svc } = await supabase
        .from('services')
        .select('name')
        .eq('id', serviceId)
        .single();
      if (svc?.name) serviceName = svc.name;
    }

    // Wyślij email
    try {
      if (email && resend) {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: `✅ Potwierdzenie rezerwacji — ${serviceName}`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: 0 auto;">
              <div style="background: #1a1a1a; padding: 24px; border-radius: 12px;">
                <h2 style="color: #f59e0b; margin-top: 0;">Rezerwacja potwierdzona ✅</h2>
                <p style="color: #e5e7eb;">Witaj <strong>${clientName}</strong>,</p>
                <p style="color: #e5e7eb;">Twoja wizyta została pomyślnie zarezerwowana.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr>
                    <td style="color: #9ca3af; padding: 8px 0; border-bottom: 1px solid #333;">Usługa</td>
                    <td style="color: #f3f4f6; font-weight: bold; padding: 8px 0; border-bottom: 1px solid #333;">${serviceName}</td>
                  </tr>
                  <tr>
                    <td style="color: #9ca3af; padding: 8px 0; border-bottom: 1px solid #333;">Data</td>
                    <td style="color: #f3f4f6; font-weight: bold; padding: 8px 0; border-bottom: 1px solid #333;">${date}</td>
                  </tr>
                  <tr>
                    <td style="color: #9ca3af; padding: 8px 0;">Godzina</td>
                    <td style="color: #f59e0b; font-weight: bold; font-size: 18px; padding: 8px 0;">${time}</td>
                  </tr>
                </table>
                <p style="color: #6b7280; font-size: 12px;">Dziękujemy za rezerwację!</p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error('Błąd wysyłki e-maila:', emailErr);
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Wystąpił nieznany błąd.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
