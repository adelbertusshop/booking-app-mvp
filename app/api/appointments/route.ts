export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get('salonId');
    const date = searchParams.get('date');
    if (!salonId || !date) return NextResponse.json({ error: 'Brak salonId lub date' }, { status: 400 });
    const { data: salon, error: salonError } = await supabase
      .from('salons')
      .select('id, is_public')
      .eq('id', salonId)
      .maybeSingle();
    if (salonError) {
      console.error('[APPOINTMENT AVAILABILITY SALON ERROR]', salonError);
      return NextResponse.json({ error: 'Nie udało się pobrać dostępności.' }, { status: 500 });
    }
    if (!salon || !salon.is_public) {
      return NextResponse.json({ error: 'Ten salon nie przyjmuje obecnie rezerwacji online.' }, { status: 404 });
    }
    const dateObj = new Date(date + 'T12:00:00');
    const jsDow = dateObj.getDay();
    const ourDow = jsDow === 0 ? 6 : jsDow - 1;
    const { data: hourData } = await supabase.from('salon_hours').select('*').eq('salon_id', salonId).eq('day_of_week', ourDow).single();
    if (!hourData || !hourData.is_working) return NextResponse.json({ bookedTimes: [], allSlots: [], isDayOff: true });
    const dayStart = `${date}T00:00:00`, dayEnd = `${date}T23:59:59`;
    const { data: booked } = await supabase.from('appointments').select('start_time, end_time').eq('salon_id', salonId).neq('status', 'cancelled').gte('start_time', dayStart).lte('start_time', dayEnd);
    const bookedTimes = (booked || []).map((a) => ({ start: a.start_time?.split('T')[1]?.substring(0, 5) || '', end: a.end_time?.split('T')[1]?.substring(0, 5) || '' }));
    return NextResponse.json({ bookedTimes, openTime: hourData.open_time.substring(0, 5), closeTime: hourData.close_time.substring(0, 5), isDayOff: false });
  } catch { return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, clientName, email, phone, salonId, serviceId } = body;
    if (!salonId) return NextResponse.json({ error: 'Brak salonId.' }, { status: 400 });
    if (!date || !time) return NextResponse.json({ error: 'Brak daty lub godziny.' }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NextResponse.json({ error: 'Nieprawidłowy format daty lub godziny.' }, { status: 400 });
    if (clientName !== undefined && (typeof clientName !== 'string' || clientName.trim().length < 2 || clientName.length > 120)) return NextResponse.json({ error: 'Nieprawidłowe imię i nazwisko.' }, { status: 400 });
    if (typeof email !== 'string' || email.trim().length === 0 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return NextResponse.json({ error: 'Nieprawidłowy adres e-mail.' }, { status: 400 });
    if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 40)) return NextResponse.json({ error: 'Nieprawidłowy numer telefonu.' }, { status: 400 });

    const startDateObj = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startDateObj.getTime())) return NextResponse.json({ error: 'Nieprawidłowa data lub godzina.' }, { status: 400 });
    if (startDateObj.getTime() <= Date.now()) return NextResponse.json({ error: 'Nie można zarezerwować terminu w przeszłości.' }, { status: 400 });

    let durationMinutes = 60, serviceName = 'Wizyta', salonName = 'Salon';
    const { data: salon } = await supabase.from('salons').select('salon_name, admin_email, is_public').eq('id', salonId).single();
    if (!salon) return NextResponse.json({ error: 'Nie znaleziono salonu.' }, { status: 404 });
    if (!salon.is_public) return NextResponse.json({ error: 'Ten salon nie przyjmuje obecnie rezerwacji online.' }, { status: 403 });
    if (salon.salon_name) salonName = salon.salon_name;

    if (serviceId) {
      const { data: svc } = await supabase.from('services').select('duration_minutes, name').eq('id', serviceId).eq('salon_id', salonId).single();
      if (!svc) return NextResponse.json({ error: 'Wybrana usługa nie należy do tego salonu.' }, { status: 400 });
      if (!Number.isInteger(svc.duration_minutes) || svc.duration_minutes <= 0 || svc.duration_minutes > 480) return NextResponse.json({ error: 'Nieprawidłowy czas trwania usługi.' }, { status: 400 });
      durationMinutes = svc.duration_minutes; if (svc.name) serviceName = svc.name;
    }

    const jsDow = startDateObj.getDay(), ourDow = jsDow === 0 ? 6 : jsDow - 1;
    const { data: hourData } = await supabase.from('salon_hours').select('open_time, close_time, is_working').eq('salon_id', salonId).eq('day_of_week', ourDow).single();
    if (!hourData || !hourData.is_working) return NextResponse.json({ error: 'Salon jest zamknięty w wybranym dniu.' }, { status: 400 });
    const [openHour, openMinute] = String(hourData.open_time).slice(0, 5).split(':').map(Number);
    const [closeHour, closeMinute] = String(hourData.close_time).slice(0, 5).split(':').map(Number);
    const requestedMinutes = startDateObj.getHours() * 60 + startDateObj.getMinutes(), closeMinutes = closeHour * 60 + closeMinute, openMinutes = openHour * 60 + openMinute;
    const endDateObj = new Date(startDateObj.getTime() + durationMinutes * 60 * 1000), endMinutes = requestedMinutes + durationMinutes;
    if (requestedMinutes < openMinutes || endMinutes > closeMinutes) return NextResponse.json({ error: 'Wybrany termin wykracza poza godziny pracy salonu.' }, { status: 400 });
    const startIso = startDateObj.toISOString(), endIso = endDateObj.toISOString();

    const { data: conflict } = await supabase.from('appointments').select('id').eq('salon_id', salonId).neq('status', 'cancelled').lt('start_time', endIso).gt('end_time', startIso).limit(1);
    if (conflict && conflict.length > 0) return NextResponse.json({ error: 'Ten termin jest już zajęty.' }, { status: 409 });

    const targetYear = startDateObj.getFullYear(), targetMonth = startDateObj.getMonth();
    const monthStart = new Date(targetYear, targetMonth, 1).toISOString(), monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59).toISOString();
    const { count: monthCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('salon_id', salonId).neq('status', 'cancelled').gte('start_time', monthStart).lte('start_time', monthEnd);
    if ((monthCount || 0) >= 50) return NextResponse.json({ error: 'Salon osiągnął limit 50 rezerwacji w tym miesiącu (plan FREE). Skontaktuj się z właścicielem salonu.', limitReached: true }, { status: 429 });

    const { data: appointment, error } = await supabase.from('appointments').insert([{
      salon_id: salonId, start_time: startIso, end_time: endIso, client_name: typeof clientName === 'string' ? clientName.trim() : clientName,
      client_email: typeof email === 'string' ? email.trim().toLowerCase() : email, client_phone: typeof phone === 'string' ? phone.trim() : phone,
      status: 'confirmed', service_id: serviceId || null,
    }]).select().single();
    if (error) {
      if (error.code === '23P01') return NextResponse.json({ error: 'Ten termin został właśnie zajęty. Wybierz inny termin.' }, { status: 409 });
      console.error('[APPOINTMENT INSERT ERROR]', error);
      return NextResponse.json({ error: 'Nie udało się zapisać rezerwacji. Spróbuj ponownie.' }, { status: 500 });
    }

    const safeClientName = escapeHtml(clientName), safeEmail = escapeHtml(email), safePhone = escapeHtml(phone), safeServiceName = escapeHtml(serviceName), safeSalonName = escapeHtml(salonName), safeDate = escapeHtml(date), safeTime = escapeHtml(time);
    if (email && resend) await resend.emails.send({ from: 'powiadomienia@lumaria-app.pl', to: [email], subject: `✅ Potwierdzenie rezerwacji — ${salonName}`, html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;padding:24px;border-radius:12px;"><h2 style="color:#f59e0b;margin-top:0;">Rezerwacja potwierdzona ✅</h2><p style="color:#e5e7eb;">Witaj <strong>${safeClientName}</strong>,</p><p style="color:#e5e7eb;">Twoja wizyta w salonie <strong style="color:#f59e0b;">${safeSalonName}</strong> została potwierdzona.</p><p style="color:#e5e7eb;">Usługa: <strong>${safeServiceName}</strong><br>Data: <strong>${safeDate}</strong><br>Godzina: <strong>${safeTime}</strong></p></div>` }).catch(console.error);
    const adminEmail = salon.admin_email;
    if (adminEmail && resend) await resend.emails.send({ from: 'powiadomienia@lumaria-app.pl', to: [adminEmail], subject: `🔔 Nowa rezerwacja — ${salonName}`, html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;padding:24px;border-radius:12px;"><h2 style="color:#f59e0b;margin-top:0;">Nowa rezerwacja 🔔</h2><p style="color:#fff;">Klient: <strong>${safeClientName}</strong><br>Email: ${safeEmail || '-'}<br>Telefon: ${safePhone || '-'}<br>Usługa: ${safeServiceName}<br>Data: ${safeDate}<br>Godzina: ${safeTime}</p></div>` }).catch(console.error);
    return NextResponse.json({ success: true, data: appointment });
  } catch (err) { console.error('[APPOINTMENT API ERROR]', err); return NextResponse.json({ error: 'Wystąpił błąd serwera. Spróbuj ponownie.' }, { status: 500 }); }
}
