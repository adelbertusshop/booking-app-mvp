import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  getAdvertisingNetPrice,
  getAdvertisingPackage,
  type AdvertisingClientType,
  type AdvertisingDurationDays,
} from '@/lib/advertising/catalog';
import {
  authenticateAdvertisingRequest,
  verifyAdvertisingSalonOwnership,
} from '@/lib/advertising/auth';
import { createAdvertisingCheckoutSession } from '@/lib/advertising/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 12 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function safeDestination(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await authenticateAdvertisingRequest(request);
  if (!auth.ok) return auth.response;

  const body = await readJson(request);
  if (!body) return fail('Nieprawidłowe lub zbyt duże dane zamówienia.', 400);

  const packageId = typeof body.packageId === 'string' ? body.packageId : '';
  const clientType = body.clientType;
  const durationDays = body.durationDays;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const destinationUrl = safeDestination(body.destinationUrl);
  const salonId = body.salonId;
  const imagePath = body.imagePath;

  const pkg = getAdvertisingPackage(packageId);
  if (!pkg) return fail('Nieznany pakiet reklamowy.', 400);
  if (clientType !== 'salon_w_aplikacji' && clientType !== 'firma_zewnetrzna') {
    return fail('Nieprawidłowy typ reklamodawcy.', 400);
  }
  if (durationDays !== 7 && durationDays !== 30 && durationDays !== 90) {
    return fail('Czas emisji musi wynosić 7, 30 lub 90 dni.', 400);
  }
  if (title.length < 3 || title.length > 120) return fail('Tytuł reklamy musi mieć od 3 do 120 znaków.', 400);
  if (description.length > 500) return fail('Opis reklamy może mieć maksymalnie 500 znaków.', 400);
  if (!destinationUrl) return fail('Adres docelowy musi być prawidłowym adresem HTTPS.', 400);
  if (imagePath !== undefined && imagePath !== null &&
      (typeof imagePath !== 'string' || imagePath.length > 1024 || imagePath.startsWith('/') || imagePath.includes('..'))) {
    return fail('Nieprawidłowa ścieżka grafiki reklamowej.', 400);
  }

  let verifiedSalonId: string | null = null;
  if (clientType === 'salon_w_aplikacji') {
    if (typeof salonId !== 'string' || !UUID_RE.test(salonId)) {
      return fail('Wybierz salon przypisany do Twojego konta.', 400);
    }
    const ownership = await verifyAdvertisingSalonOwnership(auth.context.supabase, auth.context.user.id, salonId);
    if (ownership.error) return fail(ownership.error, 503);
    if (!ownership.owned) return fail('Nie masz uprawnień do zamówienia reklamy dla tego salonu.', 403);
    verifiedSalonId = salonId;
  } else if (salonId !== undefined && salonId !== null) {
    return fail('Firma zewnętrzna nie może przekazywać identyfikatora salonu.', 400);
  }

  const idempotencyKey = request.headers.get('idempotency-key') ?? '';
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
    return fail('Brak prawidłowego klucza idempotencji.', 400);
  }

  const amountPln = getAdvertisingNetPrice(
    pkg.id,
    clientType as AdvertisingClientType,
    durationDays as AdvertisingDurationDays,
  );
  const amountMinor = amountPln * 100;
  const advertiserType = clientType === 'salon_w_aplikacji' ? 'salon' : 'external';
  const normalizedImagePath = typeof imagePath === 'string' ? imagePath : null;
  const requestSnapshot = {
    advertiserUserId: auth.context.user.id,
    advertiserType,
    clientType,
    packageId: pkg.id,
    salonId: verifiedSalonId,
    placement: pkg.placement,
    placementSlot: pkg.placementSlot,
    title,
    description,
    destinationUrl,
    imagePath: normalizedImagePath,
    durationDays,
    amountMinor,
  };
  const requestHash = createHash('sha256').update(JSON.stringify(requestSnapshot)).digest('hex');

  const { data: orderRows, error: orderError } = await auth.context.supabase.rpc(
    'lumar_create_advertising_order',
    {
      p_advertiser_user_id: auth.context.user.id,
      p_advertiser_type: advertiserType,
      p_client_type: clientType,
      p_package_id: pkg.id,
      p_salon_id: verifiedSalonId,
      p_placement: pkg.placement,
      p_placement_slot: pkg.placementSlot,
      p_title: title,
      p_body: description || null,
      p_destination_url: destinationUrl,
      p_image_path: normalizedImagePath,
      p_duration_days: durationDays,
      p_amount_minor: amountMinor,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    },
  );

  if (orderError) {
    return fail('Nie udało się bezpiecznie utworzyć zamówienia. Sprawdź konfigurację bazy reklamowej.', 503);
  }

  const order = Array.isArray(orderRows) ? orderRows[0] : null;
  if (!order || typeof order.order_id !== 'string' || typeof order.campaign_id !== 'string') {
    return fail('Baza nie zwróciła prawidłowego zamówienia.', 503);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return fail('Brak konfiguracji adresu aplikacji.', 503);
  let origin: string;
  try {
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('invalid origin');
    origin = parsed.origin;
  } catch {
    return fail('Nieprawidłowa konfiguracja adresu aplikacji.', 503);
  }

  try {
    const session = await createAdvertisingCheckoutSession({
      orderId: order.order_id,
      campaignId: order.campaign_id,
      advertiserUserId: auth.context.user.id,
      packageName: pkg.name,
      description: 'Reklama LUMAR — ' + durationDays + ' dni',
      amountMinor,
      customerEmail: auth.context.user.email ?? undefined,
      successUrl: origin + '/reklamy/wynik?session_id={CHECKOUT_SESSION_ID}',
      cancelUrl: origin + '/reklamy?status=cancelled',
    });

    if (session.livemode || !session.url || session.status !== 'open') {
      return fail('Stripe zwrócił nieprawidłową sesję testową. Nie przekierowano do płatności.', 502);
    }

    const { error: saveError } = await auth.context.supabase
      .from('ad_orders')
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', order.order_id)
      .eq('advertiser_user_id', auth.context.user.id)
      .eq('status', 'pending');

    if (saveError) return fail('Sesja płatnicza została utworzona, ale nie udało się zapisać jej w zamówieniu. Skontaktuj się z obsługą.', 503);

    return NextResponse.json({
      orderId: order.order_id,
      campaignId: order.campaign_id,
      checkoutUrl: session.url,
      payable: true,
      mode: 'test',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return fail('Nie udało się utworzyć testowej sesji płatniczej.', 502);
  }
}
