import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Wyliczamy end_time ISO
    const startDate = new Date(start_time);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const payload = {
      client_name,
      client_email,
      client_phone,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: 'confirmed',
    };

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

    return NextResponse.json({ success: true, appointment: data }, { status: 200 });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json(
      { error: `Błąd serwera API: ${err.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}