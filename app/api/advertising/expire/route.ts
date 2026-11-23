import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  const authorization = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (!secret || authorization.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // The scheduler is present in code, but writes remain disabled until the
  // operator explicitly enables this flag in the target Vercel environment.
  if (process.env.LUMAR_ADVERTISING_EXPIRY_ENABLED !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'expiry_disabled' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Advertising database is not configured.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const now = new Date().toISOString();

  const expired = await supabase
    .from('ad_campaigns')
    .update({ status: 'completed', updated_at: now })
    .in('status', ['active', 'scheduled'])
    .lte('ends_at', now)
    .select('id');

  if (expired.error) {
    return NextResponse.json({ error: 'Nie udało się zakończyć wygasłych kampanii.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const started = await supabase
    .from('ad_campaigns')
    .update({ status: 'active', updated_at: now })
    .eq('status', 'scheduled')
    .lte('starts_at', now)
    .gt('ends_at', now)
    .select('id');

  if (started.error) {
    return NextResponse.json({ error: 'Nie udało się uruchomić zaplanowanych kampanii.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return NextResponse.json({
    completed: expired.data?.length ?? 0,
    activated: started.data?.length ?? 0,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
