export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { bookingSchema } from '@/lib/schemas/booking';
import { Resend } from 'resend';

const ADMIN_EMAIL = 'wojciechjarosz41@gmail.com';

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');
    const body = await req.json();

    const parseResult = bookingSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || 'Błąd walidacji';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, phone, date, time, service } = parseResult.data;

    const { data, error } = await supabase
      .from('appointments')
      .insert([{ name, email, phone, date, time, service }])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: ADMIN_EMAIL,
        subject: `Nowa rezerwacja: ${name}`,
        html: `<p><strong>Usługa:</strong> ${service}</p>
               <p><strong>Data:</strong> ${date} godz. ${time}</p>
               <p><strong>Klient:</strong> ${name} (${email}, tel: ${phone})</p>`,
      });
    } catch (emailErr) {
      console.error('Błąd wysyłki maila:', emailErr);
    }

    return NextResponse.json({ success: true, booking: data });
  } catch (err) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}