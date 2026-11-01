import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyStripeWebhookSignature } from '@/lib/advertising/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_WEBHOOK_BYTES = 1024 * 1024;

function response(message: string, status: number) {
  return NextResponse.json({ received: status < 400, message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  const stripeSecret = process.env.STRIPE_SECRET_KEY ?? '';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!webhookSecret.startsWith('whsec_') || !stripeSecret.startsWith('sk_test_')) {
    return response('Test webhook is not configured.', 503);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return response('Database service is not configured.', 503);
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) return response('Payload too large.', 413);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) {
    return response('Payload too large.', 413);
  }

  const signature = request.headers.get('stripe-signature');
  if (!verifyStripeWebhookSignature(rawBody, signature, webhookSecret)) {
    return response('Invalid Stripe signature.', 400);
  }

  let event: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response('Invalid event payload.', 400);
    }
    event = parsed as Record<string, unknown>;
  } catch {
    return response('Invalid event JSON.', 400);
  }

  if (typeof event.id !== 'string' || typeof event.type !== 'string' || event.livemode !== false) {
    return response('Only verified Stripe test events are accepted.', 400);
  }

  // This first version deliberately accepts only immediate card payments.
  // Delayed payment methods require their separate asynchronous success lifecycle.
  if (event.type !== 'checkout.session.completed') {
    return response('Event ignored.', 200);
  }

  const data = event.data;
  const object = data && typeof data === 'object' ? (data as Record<string, unknown>).object : null;
  if (!object || typeof object !== 'object' || Array.isArray(object)) {
    return response('Missing Checkout Session object.', 400);
  }
  const session = object as Record<string, unknown>;
  const metadata = session.metadata && typeof session.metadata === 'object'
    ? session.metadata as Record<string, unknown>
    : {};

  if (session.mode !== 'payment' || session.status !== 'complete' ||
      session.payment_status !== 'paid' || session.livemode !== false ||
      session.currency !== 'pln' || typeof session.id !== 'string' ||
      typeof session.amount_total !== 'number' ||
      typeof metadata.order_id !== 'string' ||
      typeof metadata.campaign_id !== 'string') {
    return response('Checkout Session is not a paid, valid test payment.', 400);
  }

  const paymentIntent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent && typeof session.payment_intent === 'object' &&
      typeof (session.payment_intent as Record<string, unknown>).id === 'string'
      ? (session.payment_intent as Record<string, unknown>).id as string
      : null;
  if (!paymentIntent) return response('Missing PaymentIntent reference.', 400);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const { error: inboxError } = await supabase
    .from('ad_stripe_webhook_events')
    .upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: false,
      processing_status: 'received',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_event_id', ignoreDuplicates: true });

  if (inboxError) return response('Could not persist webhook event.', 503);

  const { data: result, error: applyError } = await supabase.rpc(
    'lumar_apply_advertising_payment_success',
    {
      p_event_id: event.id,
      p_order_id: metadata.order_id,
      p_campaign_id: metadata.campaign_id,
      p_advertiser_user_id: metadata.advertiser_user_id,
      p_checkout_session_id: session.id,
      p_payment_intent_id: paymentIntent,
      p_amount_total_minor: session.amount_total,
      p_currency: 'PLN',
      p_event_livemode: false,
      p_expected_livemode: false,
    },
  );

  if (applyError) {
    await supabase
      .from('ad_stripe_webhook_events')
      .update({
        processing_status: 'failed',
        attempt_count: 1,
        last_error: 'Atomic payment transition failed.',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', event.id)
      .neq('processing_status', 'processed');
    return response('Payment event requires retry.', 503);
  }

  return NextResponse.json({
    received: true,
    result: typeof result === 'string' ? result : 'processed',
    campaignStatus: 'pending_review',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
