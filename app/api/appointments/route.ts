import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBookingConfirmation } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceName, date, time, clientName, email, phone } = body;

    // Obliczamy godzinę zakończenia (+1 godzina)
    const startDateTime = new Date(`${date}T${time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const startTimeISO = startDateTime.toISOString();
    const endTimeISO = endDateTime.toISOString();

    const { data: newBooking, error: dbError } = await supabase
      .from('appointments')
      .insert([
        {
          service_id: 1,
          client_name: clientName,
          client_email: email,
          client_phone: phone,
          start_time: startTimeISO,
          end_time: endTimeISO,
          status: 'confirmed'
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('[DATABASE INSERT ERROR]:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    sendBookingConfirmation({
      to: email || 'wojciechjarosz41@gmail.com',
      clientName: clientName || 'Klient',
      serviceName: serviceName || 'Konsultacja podstawowa',
      date: date,
      startTime: time,
    }).catch(err => console.error('[EMAIL ERROR]:', err));

    return NextResponse.json({ success: true, booking: newBooking }, { status: 200 });
  } catch (err: any) {
    console.error('[CRITICAL BOOKING ERROR]:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}