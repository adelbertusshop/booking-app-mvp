export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('salons')
      .select('id, salon_name, admin_email, user_id')
      .order('salon_name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, salons: [] }, { status: 500 });
    }

    return NextResponse.json({ salons: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Błąd serwera';
    return NextResponse.json({ error: message, salons: [] }, { status: 500 });
  }
}
