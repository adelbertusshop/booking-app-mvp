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

    if (slug) {
      const { data, error } = await supabase
        .from('salons')
        .select('id, salon_name, slug')
        .eq('is_public', true)
        .eq('slug', slug)
        .limit(1);

      if (error) {
        console.error('[PUBLIC SALONS LOOKUP ERROR]', error);
        return NextResponse.json({ error: 'Nie udało się pobrać salonu.' }, { status: 500 });
      }
      return NextResponse.json({ salons: data || [] });
    }

    // The Data API may cap rows returned by a single request. Page through
    // the complete public catalogue instead of silently omitting later salons.
    const salons: Array<{ id: string; salon_name: string; slug: string | null }> = [];
    const pageSize = 100;
    let offset = 0;
    const maxRowsToRead = 10000;

    while (offset < maxRowsToRead) {
      const { data, error } = await supabase
        .from('salons')
        .select('id, salon_name, slug')
        .eq('is_public', true)
        .order('salon_name', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('[PUBLIC SALONS LIST ERROR]', error);
        return NextResponse.json({ error: 'Nie udało się pobrać katalogu salonów.' }, { status: 500 });
      }

      const page = data || [];
      if (page.length === 0) break;
      salons.push(...page);
      offset += page.length;
    }

    return NextResponse.json({ salons });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
