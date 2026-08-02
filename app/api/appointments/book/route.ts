import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, service, date } = body;

    const { data, error } = await supabase
      .from('appointments')
      .insert([{ name, email, phone, service, date }])
      .select();

    if (error) {
      console.error('Błąd Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: 'Rezerwacje <onboarding@resend.dev>',
        to: [email],
        subject: `Potwierdzenie rezerwacji: ${service}`,
        html: `<p>Cześć <strong>${name}</strong>!</p><p>Twoja wizyta na <strong>${service}</strong> w terminie <strong>${date}</strong> została zarezerwowana.</p>`,
      });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error('Błąd serwera:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}