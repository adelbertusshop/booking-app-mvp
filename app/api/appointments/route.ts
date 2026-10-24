export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const WARSAW_TIME_ZONE = 'Europe/Warsaw';

function warsawDateTimeToUtc(date: string, time: string): Date | null {
  if (!isValidCalendarDate(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;

  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: WARSAW_TIME_ZONE, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });

  const getParts = (instant: number) => Object.fromEntries(
    formatter.formatToParts(new Date(instant))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const getOffsetMinutes = (instant: number) => {
    const parts = getParts(instant);
    const localAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    return Math.round((localAsUtc - instant) / 60_000);
  };

  // Warsaw's UTC offset is stable for nearby instants except around DST changes.
  // Sample both sides of the requested wall-clock time and validate each candidate.
  const offsets = new Set([
    getOffsetMinutes(wallClock - 36 * 60 * 60 * 1000),
    getOffsetMinutes(wallClock),
    getOffsetMinutes(wallClock + 36 * 60 * 60 * 1000),
  ]);
  const matches: number[] = [];
  for (const offsetMinutes of Array.from(offsets)) {
    const candidate = wallClock - offsetMinutes * 60_000;
    const parts = getParts(candidate);
    if (Number(parts.year) === year && Number(parts.month) === month &&
        Number(parts.day) === day && Number(parts.hour) === hour &&
        Number(parts.minute) === minute) matches.push(candidate);
  }
  const uniqueMatches = Array.from(new Set(matches));
  return uniqueMatches.length === 1 ? new Date(uniqueMatches[0]) : null;
}

function warsawTimeFromIso(value: string | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: WARSAW_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get('salonId');
    const date = searchParams.get('date');
    if (!salonId || !date) return NextResponse.json({ error: 'Brak salonId lub date' }, { status: 400 });
    if (!isUuid(salonId)) return NextResponse.json({ error: 'Nieprawidłowe ID salonu.' }, { status: 400 });
    if (!isValidCalendarDate(date)) return NextResponse.json({ error: 'Nieprawidłowa data.' }, { status: 400 });

    // This route uses the service-role key when configured, so enforce public
    // visibility here rather than relying on RLS alone.
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

    const dateObj = new Date(`${date}T12:00:00Z`);
    const jsDow = dateObj.getUTCDay();
    const ourDow = jsDow === 0 ? 6 : jsDow - 1;
    const { data: hourData, error: hoursError } = await supabase.from('salon_hours').select('*').eq('salon_id', salonId).eq('day_of_week', ourDow).single();
    if (hoursError && hoursError.code !== 'PGRST116') {
      console.error('[APPOINTMENT AVAILABILITY HOURS ERROR]', hoursError);
      return NextResponse.json({ error: 'Nie udało się pobrać godzin salonu.' }, { status: 500 });
    }
    if (!hourData || !hourData.is_working) return NextResponse.json({ bookedTimes: [], allSlots: [], isDayOff: true });
    const dayStart = warsawDateTimeToUtc(date, '00:00');
    const nextDate = new Date(`${date}T12:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextDateString = nextDate.toISOString().slice(0, 10);
    const dayEnd = warsawDateTimeToUtc(nextDateString, '00:00');
    if (!dayStart || !dayEnd) return NextResponse.json({ error: 'Nie udało się ustalić granic dnia.' }, { status: 500 });
    const { data: booked, error: bookedError } = await supabase.from('appointments').select('start_time, end_time').eq('salon_id', salonId).neq('status', 'cancelled').lt('start_time', dayEnd.toISOString()).gte('start_time', dayStart.toISOString());
    if (bookedError) {
      console.error('[APPOINTMENT AVAILABILITY BOOKINGS ERROR]', bookedError);
      return NextResponse.json({ error: 'Nie udało się pobrać zajętych terminów.' }, { status: 500 });
    }
    const bookedTimes = (booked || []).map((a) => ({ start: warsawTimeFromIso(a.start_time), end: warsawTimeFromIso(a.end_time) }));
    return NextResponse.json({ bookedTimes, openTime: hourData.open_time.substring(0, 5), closeTime: hourData.close_time.substring(0, 5), isDayOff: false });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, clientName, email, phone, salonId, serviceId } = body;
    if (!salonId) return NextResponse.json({ error: 'Brak salonId.' }, { status: 400 });
    if (!isUuid(salonId)) return NextResponse.json({ error: 'Nieprawidłowe ID salonu.' }, { status: 400 });
    if (!date || !time) return NextResponse.json({ error: 'Brak daty lub godziny.' }, { status: 400 });
    if (typeof date !== 'string' || typeof time !== 'string' || !isValidCalendarDate(date) || !/^\d{2}:\d{2}$/.test(time) || Number(time.slice(0, 2)) > 23 || Number(time.slice(3, 5)) > 59) return NextResponse.json({ error: 'Nieprawidłowa data lub godzina.' }, { status: 400 });
    if (clientName !== undefined && (typeof clientName !== 'string' || clientName.trim().length < 2 || clientName.length > 120)) return NextResponse.json({ error: 'Nieprawidłowe imię i nazwisko.' }, { status: 400 });
    if (typeof email !== 'string' || email.trim().length === 0 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return NextResponse.json({ error: 'Nieprawidłowy adres e-mail.' }, { status: 400 });
    if (phone !== undefined && phone !== null && (typeof phone !== 'string' || phone.length > 40)) return NextResponse.json({ error: 'Nieprawidłowy numer telefonu.' }, { status: 400 });

    const startDateObj = warsawDateTimeToUtc(date, time);
    if (!startDateObj) return NextResponse.json({ error: 'Nieprawidłowa godzina lub godzina niejednoznaczna z powodu zmiany czasu.' }, { status: 400 });
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

    const jsDow = new Date(`${date}T12:00:00Z`).getUTCDay(), ourDow = jsDow === 0 ? 6 : jsDow - 1;
    const { data: hourData } = await supabase.from('salon_hours').select('open_time, close_time, is_working').eq('salon_id', salonId).eq('day_of_week', ourDow).single();
    if (!hourData || !hourData.is_working) return NextResponse.json({ error: 'Salon jest zamknięty w wybranym dniu.' }, { status: 400 });
    const [openHour, openMinute] = String(hourData.open_time).slice(0, 5).split(':').map(Number);
    const [closeHour, closeMinute] = String(hourData.close_time).slice(0, 5).split(':').map(Number);
    const [requestedHour, requestedMinute] = time.split(':').map(Number);
    const requestedMinutes = requestedHour * 60 + requestedMinute, closeMinutes = closeHour * 60 + closeMinute, openMinutes = openHour * 60 + openMinute;
    const endDateObj = new Date(startDateObj.getTime() + durationMinutes * 60 * 1000), endMinutes = requestedMinutes + durationMinutes;
    if (requestedMinutes < openMinutes || endMinutes > closeMinutes) return NextResponse.json({ error: 'Wybrany termin wykracza poza godziny pracy salonu.' }, { status: 400 });
    const startIso = startDateObj.toISOString(), endIso = endDateObj.toISOString();

    const { data: conflict } = await supabase.from('appointments').select('id').eq('salon_id', salonId).neq('status', 'cancelled').lt('start_time', endIso).gt('end_time', startIso).limit(1);
    if (conflict && conflict.length > 0) return NextResponse.json({ error: 'Ten termin jest już zajęty.' }, { status: 409 });

    const { data: appointment, error } = await supabase.from('appointments').insert([{
      salon_id: salonId, start_time: startIso, end_time: endIso, client_name: typeof clientName === 'string' ? clientName.trim() : clientName,
      client_email: typeof email === 'string' ? email.trim().toLowerCase() : email, client_phone: typeof phone === 'string' ? phone.trim() : phone,
      status: 'confirmed', service_id: serviceId || null,
    }]).select().single();
    if (error) {
      if (error.code === '23P01') return NextResponse.json({ error: 'Ten termin został właśnie zajęty. Wybierz inny termin.' }, { status: 409 });
      // Do not expose raw database errors to public booking clients.
      console.error('[APPOINTMENT INSERT ERROR]', { code: error.code, message: error.message, details: error.details });
      if (error.code === '23505') return NextResponse.json({ error: 'Nie udało się zapisać rezerwacji z powodu konfliktu danych. Spróbuj ponownie lub wybierz inny termin.' }, { status: 409 });
      return NextResponse.json({ error: 'Nie udało się zapisać rezerwacji. Spróbuj ponownie później.' }, { status: 500 });
    }

    const safeClientName = escapeHtml(clientName), safeEmail = escapeHtml(email), safePhone = escapeHtml(phone), safeServiceName = escapeHtml(serviceName), safeSalonName = escapeHtml(salonName), safeDate = escapeHtml(date), safeTime = escapeHtml(time);
    if (email && resend) await resend.emails.send({ from: 'powiadomienia@lumaria-app.pl', to: [email], subject: `✅ Potwierdzenie rezerwacji — ${salonName}`, html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;padding:24px;border-radius:12px;"><h2 style="color:#f59e0b;margin-top:0;">Rezerwacja potwierdzona ✅</h2><p style="color:#e5e7eb;">Witaj <strong>${safeClientName}</strong>,</p><p style="color:#e5e7eb;">Twoja wizyta w salonie <strong style="color:#f59e0b;">${safeSalonName}</strong> została potwierdzona.</p><p style="color:#e5e7eb;">Usługa: <strong>${safeServiceName}</strong><br>Data: <strong>${safeDate}</strong><br>Godzina: <strong>${safeTime}</strong></p></div>` }).catch(console.error);
    const adminEmail = salon.admin_email;
    if (adminEmail && resend) await resend.emails.send({ from: 'powiadomienia@lumaria-app.pl', to: [adminEmail], subject: `🔔 Nowa rezerwacja — ${salonName}`, html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#1a1a1a;padding:24px;border-radius:12px;"><h2 style="color:#f59e0b;margin-top:0;">Nowa rezerwacja 🔔</h2><p style="color:#fff;">Klient: <strong>${safeClientName}</strong><br>Email: ${safeEmail || '-'}<br>Telefon: ${safePhone || '-'}<br>Usługa: ${safeServiceName}<br>Data: ${safeDate}<br>Godzina: ${safeTime}</p></div>` }).catch(console.error);
    return NextResponse.json({ success: true, data: appointment });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : 'Błąd.' }, { status: 500 }); }
}
