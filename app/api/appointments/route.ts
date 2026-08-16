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

    // 1. Wyznaczenie czasy rozpoczęcia (start_time)
    let startDateObj: Date;
    if (start_time) {
      startDateObj = new Date(start_time);
    } else if (date && time) {
      startDateObj = new Date(`${date}T${time}:00`);
    } else {
      return NextResponse.json({ error: 'Nie przekazano daty i godziny' }, { status: 400 });
    }

    // 2. Pobranie szczegółów usługi
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

    // 3. Wyznaczenie czasy zakończenia (end_time)
    const endDateObj = new Date(startDateObj.getTime() + durationMinutes * 60 * 1000);

    const requestedStartIso = startDateObj.toISOString();
    const requestedEndIso = endDateObj.toISOString();

    // 4. WERYFIKACJA KOLIZJI TERMINÓW
    // Szukamy istniejących wizyt, które nakładają się na żądany przedział: (start < requestedEnd) AND (end > requestedStart)
    const { data: overlappingAppointments, error: overlapError } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .neq('status', 'cancelled')
      .lt('start_time', requestedEndIso)
      .gt('end_time', requestedStartIso);

    if (overlapError) {
      console.error('Błąd weryfikacji dostępności:', overlapError);
      return NextResponse.json({ error: 'Błąd sprawdzania dostępności terminu' }, { status: 500 });
    }

    // Jeśli znaleziono nakładającą się rezerwację
    if (overlappingAppointments && overlappingAppointments.length > 0) {
      // Pobieramy wszystkie wizyty z danego dnia, żeby znaleźć najbliższy wolny slot
      const dayStart = new Date(startDateObj);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(startDateObj);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: dayAppointments } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .neq('status', 'cancelled')
        .gte('start_time', dayStart.toISOString())
        .lte('end_time', dayEnd.toISOString())
        .order('start_time', { ascending: true });

      // Propozycja wolnego terminu: szukamy pierwszego wolnego slotu po wybranym czasie
      let suggestedTime: string | null = null;
      let candidateStart = new Date(endDateObj); // Zaczynamy szukać od końca zajętego terminu

      // Zakres godzin pracy (np. 08:00 - 18:00)
      const workEnd = new Date(startDateObj);
      workEnd.setHours(18, 0, 0, 0);

      while (candidateStart.getTime() + durationMinutes * 60 * 1000 <= workEnd.getTime()) {
        const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60 * 1000);

        const hasConflict = dayAppointments?.some((app) => {
          const appStart = new Date(app.start_time).getTime();
          const appEnd = new Date(app.end_time).getTime();
          return candidateStart.getTime() < appEnd && candidateEnd.getTime() > appStart;
        });

        if (!hasConflict) {
          suggestedTime = candidateStart.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
          break;
        }

        // Przesuwamy co 30 minut w poszukiwaniu luki
        candidateStart = new Date(candidateStart.getTime() + 30 * 60 * 1000);
      }

      return NextResponse.json(
        { 
          error: 'Wybrany termin jest już zajęty.',
          suggestedTime: suggestedTime 
            ? `Najbliższy wolny termin tego dnia to ${suggestedTime}.` 
            : 'Brak innych wolnych terminów tego dnia. Wybierz inny dzień.'
        }, 
        { status: 409 }
      );
    }

    // 5. Zapis w bazie (jeśli brak kolizji)
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          service_id: Number(service_id),
          start_time: requestedStartIso,
          end_time: requestedEndIso,
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

    // 6. Powiadomienia e-mail
    if (process.env.RESEND_API_KEY) {
      const formattedDate = date || startDateObj.toLocaleDateString('pl-PL');
      const formattedTime = time || startDateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

      try {
        // Mail do Admina
        await resend.emails.send({
          from: 'Rezerwacje <onboarding@resend.dev>',
          to: ['wojciechjarosz41@gmail.com'],
          replyTo: finalEmail,
          subject: `Nowa rezerwacja: ${serviceName} - ${finalName}`,
          html: `
            <h2>Nowa rezerwacja w systemie!</h2>
            <p><strong>Klient:</strong> ${finalName}</p>
            <p><strong>E-mail:</strong> ${finalEmail}</p>
            <p><strong>Telefon:</strong> ${finalPhone}</p>
            <hr />
            <p><strong>Usługa:</strong> ${serviceName}</p>
            <p><strong>Data:</strong> ${formattedDate}</p>
            <p><strong>Godzina:</strong> ${formattedTime}</p>
          `,
        });

        // Mail do Klienta
        if (finalEmail) {
          await resend.emails.send({
            from: 'Rezerwacje <onboarding@resend.dev>',
            to: [finalEmail],
            subject: `Potwierdzenie rezerwacji - ${serviceName}`,
            html: `
              <h2>Dziękujemy za rezerwację!</h2>
              <p>Cześć <strong>${finalName}</strong>,</p>
              <p>Twoja wizyta została pomyślnie zarezerwowana. Oto szczegóły:</p>
              <ul>
                <li><strong>Usługa:</strong> ${serviceName}</li>
                <li><strong>Data:</strong> ${formattedDate}</li>
                <li><strong>Godzina:</strong> ${formattedTime}</li>
              </ul>
              <p>Do zobaczenia!</p>
            `,
          });
        }
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