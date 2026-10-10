export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    let query = supabase
      .from('salons')
      .select('id, salon_name, slug')
      .eq('is_public', true)
      .order('salon_name', { ascending: true });

    if (slug) query = query.eq('slug', slug).limit(1);

    const { data, error } = await query;

    if (error) {
      console.error('[SALONS API ERROR]', error);
      return NextResponse.json({ error: 'Nie udało się pobrać listy salonów.' }, { status: 500 });
    }
    return NextResponse.json({ salons: data || [] });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
