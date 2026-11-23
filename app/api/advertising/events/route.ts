import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEMENTS = new Set(['salon_catalog', 'lumar_pages']);

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 4096) return fail('Żądanie jest zbyt duże.', 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Nieprawidłowe dane zdarzenia.', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Nieprawidłowe dane zdarzenia.', 400);
  }

  const input = body as Record<string, unknown>;
  const campaignId = input.campaignId;
  const eventType = input.eventType;
  const placement = input.placement;
  if (typeof campaignId !== 'string' || !UUID_RE.test(campaignId) ||
      (eventType !== 'impression' && eventType !== 'click') ||
      typeof placement !== 'string' || !PLACEMENTS.has(placement)) {
    return fail('Nieprawidłowe dane zdarzenia.', 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceRoleKey) return fail('Pomiar reklam jest chwilowo niedostępny.', 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const now = new Date().toISOString();
  const { data: campaign, error: lookupError } = await supabase
    .from('ad_campaigns')
    .select('id, placement, status, starts_at, ends_at')
    .eq('id', campaignId)
    .eq('placement', placement)
    .eq('status', 'active')
    .lte('starts_at', now)
    .gt('ends_at', now)
    .maybeSingle();

  if (lookupError) return fail('Nie udało się zweryfikować kampanii.', 503);
  if (!campaign) return fail('Kampania nie jest aktywna.', 404);

  const { error } = await supabase.from('ad_events').insert({
    campaign_id: campaignId,
    event_type: eventType,
    placement,
    occurred_at: now,
  });
  if (error) return fail('Nie udało się zapisać zdarzenia reklamy.', 503);

  return NextResponse.json({ recorded: true }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  });
}
