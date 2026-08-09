import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { client_name, client_email, client_phone, start_time } = body;

    if (!client_name || !client_email || !client_phone || !start_time) {
      return NextResponse.json(
        { error: 'Wszystkie pola są wymagane.' },
        { status: 400 }
      );
    }

    // Automatycznie wyliczamy end_time (+1 godzina od start_time)
    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    // Formatowanie daty do postaci akceptowanej przez Postgres
    const end_time = endDate.toISOString();

    // Wstawienie rezerwacji ze start_time oraz end_time
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          client_name,
          client_email,
          client_phone,
          start_time,
          end_time,
          status: 'confirmed',
        },
      ])
      .select();

    if (error) {
      console.error('Supabase Insert Error:', error);
      return NextResponse.json(
        { error: `Błąd bazy: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, appointment: data }, { status: 201 });
  } catch (err: any) {
    console.error('Server Catch Error:', err);
    return NextResponse.json(
      { error: err.message || 'Wystąpił nieoczekiwany błąd.' },
      { status: 500 }
    );
  }
}