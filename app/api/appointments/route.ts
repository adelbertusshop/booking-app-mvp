import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { client_name, client_email, client_phone, start_time, service_id } = body;

    if (!client_name || !client_email || !client_phone || !start_time || !service_id) {
      return NextResponse.json(
        { error: 'Uzupełnij wszystkie wymagane pola!' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          client_name,
          client_email,
          client_phone,
          start_time,
          service_id: Number(service_id),
        },
      ])
      .select();

    if (error) {
      console.error('Błąd Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error('Błąd serwera:', err);
    return NextResponse.json({ error: err.message || 'Wystąpił błąd serwera' }, { status: 500 });
  }
}
