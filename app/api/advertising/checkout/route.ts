import { createHash } from 'node:crypto';
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
import {
  createAdvertisingCheckoutSession,
  getAdvertisingCheckoutIdempotencyKey,
  retrieveAdvertisingCheckoutSession,
} from '@/lib/advertising/stripe';

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
  // Hard stop: advertising Checkout is never available on the production deployment.
  // The Stripe helper independently accepts only sk_test_ keys.
  if (process.env.VERCEL_ENV === 'production') {
    return fail('Płatności reklamowe są wyłączone w środowisku produkcyjnym.', 503);
  }

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
      (typeof imagePath !== 'string' || imagePath.length > 1024 || !/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(imagePath) ||
       imagePath.includes('..') || !imagePath.startsWith(`${auth.context.user.id}/`))) {
    return fail('Nieprawidłowa ścieżka grafiki reklamowej.', 400);
  }
  if (['in_app_banner', 'home_screen_banner', 'sponsored_carousel'].includes(pkg.id) &&
      typeof imagePath !== 'string') {
    return fail('Dla tego pakietu dodaj grafikę JPG, PNG lub WEBP.', 400);
  }

  if (typeof imagePath === 'string') {
    const parts = imagePath.split('/');
    const fileName = parts.pop() ?? '';
    const { data: storedFiles, error: storageError } = await auth.context.supabase.storage
      .from('lumar-advertising')
      .list(auth.context.user.id, { search: fileName, limit: 10 });
    if (storageError) return fail('Nie udało się zweryfikować przesłanej grafiki.', 503);
    if (!storedFiles?.some((item) => item.name === fileName)) {
      return fail('Przesłana grafika nie istnieje lub nie należy do tego konta.', 400);
    }
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

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const vercelHost = process.env.VERCEL_URL;
  let origin: string;
  try {
    const siteUrl = configuredSiteUrl || (vercelHost ? 'https://' + vercelHost : null);
    if (!siteUrl) throw new Error('missing site url');
    const parsed = new URL(siteUrl);
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('invalid origin');
    origin = parsed.origin;
  } catch {
    return fail('Nieprawidłowa konfiguracja adresu aplikacji.', 503);
  }

  const { data: currentOrder, error: currentOrderError } = await auth.context.supabase
    .from('ad_orders')
    .select('status, stripe_checkout_session_id')
    .eq('id', order.order_id)
    .eq('advertiser_user_id', auth.context.user.id)
    .maybeSingle();

  if (currentOrderError || !currentOrder) {
    return fail('Nie udało się odczytać stanu zamówienia reklamowego.', 503);
  }
  if (currentOrder.status !== 'pending') {
    return fail('To zamówienie nie oczekuje już na płatność.', 409);
  }

  const checkoutInput = {
    orderId: order.order_id,
    campaignId: order.campaign_id,
    advertiserUserId: auth.context.user.id,
    packageName: pkg.name,
    description: 'Reklama LUMAR — ' + durationDays + ' dni',
    amountMinor,
    customerEmail: auth.context.user.email ?? undefined,
    successUrl: origin + '/reklamy?payment_return=1&session_id={CHECKOUT_SESSION_ID}',
    cancelUrl: origin + '/reklamy?payment_cancelled=1',
  };

  try {
    let session: Awaited<ReturnType<typeof createAdvertisingCheckoutSession>>;
    const previousSessionId = currentOrder.stripe_checkout_session_id;

    if (previousSessionId) {
      const previousSession = await retrieveAdvertisingCheckoutSession(previousSessionId);
      const metadata = previousSession.metadata ?? {};
      const belongsToThisOrder =
        previousSession.livemode === false &&
        previousSession.mode === 'payment' &&
        previousSession.currency === 'pln' &&
        previousSession.amount_total === amountMinor &&
        previousSession.client_reference_id === order.order_id &&
        metadata.order_id === order.order_id &&
        metadata.campaign_id === order.campaign_id &&
        metadata.advertiser_user_id === auth.context.user.id;

      if (!belongsToThisOrder) {
        return fail('Zapamiętana sesja Stripe nie pasuje do tego zamówienia.', 502);
      }

      if (previousSession.status === 'open' && previousSession.url) {
        session = previousSession;
      } else if (previousSession.status === 'expired' && previousSession.payment_status === 'unpaid') {
        // The old session ID forms a stable retry key. Concurrent retries for
        // the same expired session therefore receive the same replacement.
        session = await createAdvertisingCheckoutSession(
          checkoutInput,
          getAdvertisingCheckoutIdempotencyKey(order.order_id, previousSession.id),
        );
      } else {
        return fail('Sesja płatnicza została już zakończona lub wymaga potwierdzenia. Odśwież zamówienie.', 409);
      }
    } else {
      session = await createAdvertisingCheckoutSession(
        checkoutInput,
        getAdvertisingCheckoutIdempotencyKey(order.order_id),
      );
    }

    if (session.livemode || !session.url || session.status !== 'open') {
      return fail('Stripe zwrócił nieprawidłową sesję testową. Nie przekierowano do płatności.', 502);
    }

    if (session.id !== previousSessionId) {
      const { error: saveError } = await auth.context.supabase
        .from('ad_orders')
        .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
        .eq('id', order.order_id)
        .eq('advertiser_user_id', auth.context.user.id)
        .eq('status', 'pending');

      if (saveError) {
        return fail('Sesja płatnicza została utworzona, ale nie udało się zapisać jej w zamówieniu. Skontaktuj się z obsługą.', 503);
      }
    }

    return NextResponse.json({
      orderId: order.order_id,
      campaignId: order.campaign_id,
      checkoutUrl: session.url,
      payable: true,
      mode: 'test',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return fail('Nie udało się utworzyć lub odnowić testowej sesji płatniczej.', 502);
  }
}
