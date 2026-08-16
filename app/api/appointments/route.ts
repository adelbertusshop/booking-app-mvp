import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      service_id, 
      date, 
      time, 
      start_time, 
      client_name, 
      client_email, 
      client_phone,
      name,
      email,
      phone 
    } = body;

    const finalName = client_name || name;
    const finalEmail = client_email || email;
    const finalPhone = client_phone || phone;

    // 1. Ustalenie start_time
    let startDateObj: Date;
    if (start_time) {
      startDateObj = new Date(start_time);
    } else if (date && time) {
      startDateObj = new Date(`${date}T${time}:00`);
    } else {
      return NextResponse.json({ error: 'Nie przekazano daty i godziny' }, { status: 400 });
    }

    // 2. Pobranie nazwy usługi i czasu trwania
    let serviceName = 'Wizyta';
    let durationMinutes = 60;

    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('name, duration_minutes')
        .eq('id', Number(service_id))
        .maybeSingle();

      if (service) {
        serviceName = service.name || serviceName;
        durationMinutes = service.duration_minutes || durationMinutes;
      }
    }

    // 3. Obliczenie end_time
    const endDateObj = new Date(startDateObj.getTime() + durationMinutes * 60 * 1000);

    // 4. Zapis w bazie Supabase
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          service_id: Number(service_id),
          start_time: startDateObj.toISOString(),
          end_time: endDateObj.toISOString(),
          client_name: finalName,
          client_email: finalEmail,
          client_phone: finalPhone,
          status: 'confirmed',
        },
      ])
      .select();

    if (error) {
      console.error('Błąd Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 5. WYSYŁKA POWIADOMIENIA E-MAIL NA TWÓJ ADRES
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Rezerwacje <onboarding@resend.dev>',
          to: ['wojciechjarosz41@gmail.com'],
          replyTo: finalEmail,
          subject: `Nowa rezerwacja: ${serviceName} - ${finalName}`,
          html: `
            <h2>Nowa rezerwacja w systemie!</h2>
            <p><strong>Klient:</strong> ${finalName}</p>
            <p><strong>E-mail klienta:</strong> ${finalEmail}</p>
            <p><strong>Telefon:</strong> ${finalPhone}</p>
            <hr />
            <p><strong>Usługa:</strong> ${serviceName}</p>
            <p><strong>Data:</strong> ${date || startDateObj.toLocaleDateString('pl-PL')}</p>
            <p><strong>Godzina:</strong> ${time || startDateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</p>
          `,
        });
      } catch (emailErr) {
        console.error('Błąd wysyłki e-maila:', emailErr);
      }
    }

    return NextResponse.json({ success: true, appointment: data });
  } catch (err) {
    console.error('Błąd serwera:', err);
    return NextResponse.json({ error: 'Błąd serwera przy zapisie' }, { status: 500 });
  }
}