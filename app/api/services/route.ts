export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const salonId = searchParams.get('salonId');

    if (!salonId) {
      return NextResponse.json({ error: 'Brak salonId' }, { status: 400 });
    }
    if (!isUuid(salonId)) {
      return NextResponse.json({ error: 'Nieprawidłowe ID salonu.' }, { status: 400 });
    }

    // The service-role key bypasses RLS, so verify publication status here.
    const { data: salon, error: salonError } = await supabase
      .from('salons')
      .select('id')
      .eq('id', salonId)
      .eq('is_public', true)
      .maybeSingle();

    if (salonError) {
      console.error('[PUBLIC SERVICES SALON ERROR]', salonError);
      return NextResponse.json({ error: 'Nie udało się pobrać usług.' }, { status: 500 });
    }

    if (!salon) {
      return NextResponse.json({ error: 'Salon nie jest dostępny publicznie.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('salon_id', salonId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[PUBLIC SERVICES QUERY ERROR]', error);
      return NextResponse.json({ error: 'Nie udało się pobrać usług.' }, { status: 500 });
    }

    return NextResponse.json({ services: data || [] });
  } catch (error) {
    console.error('[PUBLIC SERVICES API ERROR]', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
