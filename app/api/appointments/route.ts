export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function generateSlots(openTime: string, closeTime: string, durationMinutes: number): string[] {
  const slots: string[] = [];
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  let current = open;
  while (current + durationMinutes <= close) {
    const h = Math.floor(current / 60).toString().padStart(2, '0');
    const m = (current % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    current += 30;
  }
  return slots;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get('salonId');
    const date = searchParams.get('date');

    if (!salonId || !date) return NextResponse.json({ error: 'Brak salonId lub date' }, { status: 400 });

    // Dzień tygodnia (0=Pon w naszym systemie, JS: 0=Niedz)
    const dateObj = new Date(date + 'T12:00:00');
    const jsDow = dateObj.getDay(); // 0=Niedz, 1=Pon...6=Sob
    const ourDow = jsDow === 0 ? 6 : jsDow - 1; // 0=Pon...6=Niedz

    // Pobierz godziny pracy dla tego dnia
    const { data: hourData } = await supabase
      .from('salon_hours')
      .select('*')
      .eq('salon_id', salonId)
      .eq('day_of_week', ourDow)
      .single();

    // Jeśli dzień wolny lub brak godzin — zwróć puste sloty
    if (!hourData || !hourData.is_working) {
      return NextResponse.json({ bookedTimes: [], allSlots: [], isDayOff: true });
    }

    // Pobierz zajęte terminy
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    const { data: booked } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('salon_id', salonId)
      .neq('status', 'cancelled')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd);

    const bookedTimes = (booked || []).map((a) => ({
      start: a.start_time?.split('T')[1]?.substring(0, 5) || '',
      end: a.end_time?.split('T')[1]?.substring(0, 5) || '',
    }));

    return NextResponse.json({
      bookedTimes,
      openTime: hourData.open_time.substring(0, 5),
      closeTime: hourData.close_time.substring(0, 5),
      isDayOff: false,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, clientName, email, phone, salonId, serviceId } = body;

    if (!salonId) return NextResponse.json({ error: 'Brak salonId.' }, { status: 400 });
    if (!date || !time) return NextResponse.json({ error: 'Brak daty lub godziny.' }, { status: 400 });

    let durationMinutes = 60;
    let serviceName = 'Wizyta';
    let salonName = 'Salon';

    const { data: salon } = await supabase.from('salons').select('salon_name, admin_email').eq('id', salonId).single();
    if (salon?.salon_name) salonName = salon.salon_name;

    if (serviceId) {
      const { data: svc } = await supabase.from('services').select('duration_minutes, name').eq('id', serviceId).single();
      if (svc?.duration_minutes) durationMinutes = svc.duration_minutes;
      if (svc?.name) serviceName = svc.name;
    }

    const startDateObj = new Date(`${date}T${time}:00`);
    const endDateObj = new Date(startDateObj.getTime() + durationMinutes * 60 * 1000);
    const startIso = startDateObj.toISOString();
    const endIso = endDateObj.toISOString();

    // Sprawdź kolizję
    const { data: conflict } = await supabase.from('appointments').select('id')
      .eq('salon_id', salonId).neq('status', 'cancelled')
      .lt('start_time', endIso).gt('end_time', startIso).limit(1);
    if (conflict && conflict.length > 0) {
      return NextResponse.json({ error: 'Ten termin jest już zajęty.' }, { status: 409 });
    }

    // Sprawdź limit FREE (50 rezerwacji miesięcznie)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const { count: monthCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('salon_id', salonId)
      .neq('status', 'cancelled')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd);

    if ((monthCount || 0) >= 50) {
      return NextResponse.json({
        error: 'Salon osiągnął limit 50 rezerwacji w tym miesiącu (plan FREE). Skontaktuj się z właścicielem salonu.',
        limitReached: true,
      }, { status: 429 });
    }

    const { data: appointment, error } = await supabase.from('appointments')
      .insert([{ salon_id: salonId, start_time: startIso, end_time: endIso, client_name: clientName, client_email: email, client_phone: phone, status: 'confirmed', service_id: serviceId || null }])
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Email klient
    if (email && resend) {
      await resend.emails.send({
        from: 'onboarding@resend.dev', to: [email],
        subject: `✅ Potwierdzenie rezerwacji — ${salonName}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;padding:24px;border-radius:12px;"><h2 style="color:#f59e0b;margin-top:0;">Rezerwacja potwierdzona ✅</h2><p style="color:#e5e7eb;">Witaj <strong>${clientName}</strong>,</p><p style="color:#e5e7eb;">Twoja wizyta w salonie <strong style="color:#f59e0b;">${salonName}</strong> została potwierdzona.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="color:#9ca3af;padding:8px 0;border-bottom:1px solid #333;">Usługa</td><td style="color:#f3f4f6;font-weight:bold;padding:8px 0;border-bottom:1px solid #333;">${serviceName}</td></tr><tr><td style="color:#9ca3af;padding:8px 0;border-bottom:1px solid #333;">Data</td><td style="color:#f3f4f6;font-weight:bold;padding:8px 0;border-bottom:1px solid #333;">${date}</td></tr><tr><td style="color:#9ca3af;padding:8px 0;">Godzina</td><td style="color:#f59e0b;font-weight:bold;font-size:18px;padding:8px 0;">${time}</td></tr></table><p style="color:#6b7280;font-size:12px;">Do zobaczenia! 💇</p></div>`,
      }).catch(console.error);
    }

    // Email admin
    const adminEmail = salon?.admin_email;
    if (adminEmail && resend) {
      await resend.emails.send({
        from: 'onboarding@resend.dev', to: [adminEmail],
        subject: `🔔 Nowa rezerwacja — ${salonName}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;padding:24px;border-radius:12px;"><h2 style="color:#f59e0b;margin-top:0;">Nowa rezerwacja 🔔</h2><table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="color:#9ca3af;padding:8px 0;border-bottom:1px solid #333;">Klient</td><td style="color:#fff;font-weight:bold;padding:8px 0;border-bottom:1px solid #333;">${clientName}</td></tr><tr><td style="color:#9ca3af;padding:8px 0;border-bottom:1px solid #333;">Email</td><td style="color:#f3f4f6;padding:8px 0;border-bottom:1px solid #333;">${email||'-'}</td></tr><tr><td style="color:#9ca3af;padding:8px 0;border-bottom:1px solid #333;">Telefon</td><td style="color:#f3f4f6;padding:8px 0;border-bottom:1px solid #333;">${phone||'-'}</td></tr><tr><td style="color:#9ca3af;padding:8px 0;border-bottom:1px solid #333;">Usługa</td><td style="color:#f3f4f6;padding:8px 0;border-bottom:1px solid #333;">${serviceName}</td></tr><tr><td style="color:#9ca3af;padding:8px 0;border-bottom:1px solid #333;">Data</td><td style="color:#f3f4f6;font-weight:bold;padding:8px 0;border-bottom:1px solid #333;">${date}</td></tr><tr><td style="color:#9ca3af;padding:8px 0;">Godzina</td><td style="color:#f59e0b;font-weight:bold;font-size:18px;padding:8px 0;">${time}</td></tr></table></div>`,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Błąd.' }, { status: 500 });
  }
}
