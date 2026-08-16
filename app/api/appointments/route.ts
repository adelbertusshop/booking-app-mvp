import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // 2. Pobranie czasu trwania usługi dla wyliczenia end_time
    let durationMinutes = 90; // domyślnie 90 min
    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', Number(service_id))
        .maybeSingle();

      if (service?.duration_minutes) {
        durationMinutes = service.duration_minutes;
      }
    }

    // 3. Obliczenie end_time (start_time + durationMinutes)
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

    return NextResponse.json({ success: true, appointment: data });
  } catch (err) {
    console.error('Błąd serwera:', err);
    return NextResponse.json({ error: 'Błąd serwera przy zapisie' }, { status: 500 });
  }
}