import { NextResponse } from 'next/server';
import {
  authenticateAdvertisingRequest,
  requireAdvertisingPlatformAdmin,
} from '@/lib/advertising/auth';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;
  const adminError = requireAdvertisingPlatformAdmin(auth.context.user);
  if (adminError) return adminError;

  const { data, error } = await auth.context.supabase
    .from('ad_campaigns')
    .select('id, advertiser_user_id, advertiser_type, client_type, package_id, salon_id, placement, placement_slot, title, body, destination_url, image_path, duration_days, status, created_at')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return fail('Nie udało się pobrać kampanii do moderacji.', 503);
  return NextResponse.json({ campaigns: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PATCH(request: Request) {
  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;
  const adminError = requireAdvertisingPlatformAdmin(auth.context.user);
  if (adminError) return adminError;

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 4 * 1024) return fail('Żądanie jest zbyt duże.', 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Nieprawidłowe dane moderacji.', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Nieprawidłowe dane moderacji.', 400);
  }

  const input = body as Record<string, unknown>;
  const campaignId = input.campaignId;
  const decision = input.decision;
  const note = typeof input.note === 'string' ? input.note.trim() : '';

  if (typeof campaignId !== 'string' || !UUID_RE.test(campaignId)) {
    return fail('Nieprawidłowy identyfikator kampanii.', 400);
  }
  if (decision !== 'approve' && decision !== 'reject') {
    return fail('Decyzja musi być approve albo reject.', 400);
  }
  if (note.length > 1000) return fail('Notatka może mieć maksymalnie 1000 znaków.', 400);

  const { data: campaign, error: lookupError } = await auth.context.supabase
    .from('ad_campaigns')
    .select('id, duration_days, status')
    .eq('id', campaignId)
    .maybeSingle();

  if (lookupError) return fail('Nie udało się odczytać kampanii.', 503);
  if (!campaign) return fail('Nie znaleziono kampanii.', 404);
  if (campaign.status !== 'pending_review') return fail('Kampania nie oczekuje już na moderację.', 409);

  const now = new Date();
  const startsAt = decision === 'approve' ? now.toISOString() : null;
  const endsAt = decision === 'approve'
    ? new Date(now.getTime() + Number(campaign.duration_days) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: updated, error: updateError } = await auth.context.supabase
    .from('ad_campaigns')
    .update({
      status: decision === 'approve' ? 'active' : 'rejected',
      starts_at: startsAt,
      ends_at: endsAt,
      reviewed_by: auth.context.user.id,
      reviewed_at: now.toISOString(),
      moderation_note: note || null,
      updated_at: now.toISOString(),
    })
    .eq('id', campaignId)
    .eq('status', 'pending_review')
    .select('id, status, starts_at, ends_at, reviewed_at')
    .maybeSingle();

  if (updateError) return fail('Nie udało się zapisać decyzji moderacyjnej.', 503);
  if (!updated) return fail('Kampania została równolegle zmieniona. Odśwież listę moderacji.', 409);

  return NextResponse.json({ campaign: updated }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
