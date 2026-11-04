import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

export type StripeCheckoutInput = {
  orderId: string;
  campaignId: string;
  advertiserUserId: string;
  packageName: string;
  description: string;
  amountMinor: number;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required' | null;
  livemode: boolean;
};

function getTestSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key.startsWith('sk_test_')) {
    throw new Error('Stripe test mode is not configured. Checkout is disabled.');
  }
  return key;
}

export async function createAdvertisingCheckoutSession(
  input: StripeCheckoutInput,
): Promise<StripeCheckoutSession> {
  const secretKey = getTestSecretKey();
  const form = new URLSearchParams();

  form.set('mode', 'payment');
  form.set('payment_method_types[0]', 'card');
  form.set('client_reference_id', input.orderId);
  form.set('success_url', input.successUrl);
  form.set('cancel_url', input.cancelUrl);
  form.set('locale', 'pl');
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', 'pln');
  form.set('line_items[0][price_data][unit_amount]', String(input.amountMinor));
  form.set('line_items[0][price_data][product_data][name]', input.packageName);
  form.set('line_items[0][price_data][product_data][description]', input.description);
  form.set('metadata[order_id]', input.orderId);
  form.set('metadata[campaign_id]', input.campaignId);
  form.set('metadata[advertiser_user_id]', input.advertiserUserId);
  form.set('payment_intent_data[metadata][order_id]', input.orderId);
  form.set('payment_intent_data[metadata][campaign_id]', input.campaignId);

  if (input.customerEmail) form.set('customer_email', input.customerEmail);

  const response = await fetch(STRIPE_API_BASE + '/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + secretKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': 'lumar-advertising-' + input.orderId,
    },
    body: form.toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.id !== 'string') {
    const stripeMessage = payload && typeof payload.error === 'object' && payload.error !== null
      ? (payload.error as Record<string, unknown>).message
      : null;
    throw new Error(typeof stripeMessage === 'string' ? stripeMessage.slice(0, 300) : 'Stripe nie utworzył sesji Checkout.');
  }

  return {
    id: payload.id,
    url: typeof payload.url === 'string' ? payload.url : null,
    status: payload.status === 'open' || payload.status === 'complete' || payload.status === 'expired'
      ? payload.status
      : null,
    payment_status: payload.payment_status === 'paid' || payload.payment_status === 'unpaid' || payload.payment_status === 'no_payment_required'
      ? payload.payment_status
      : null,
    livemode: payload.livemode === true,
  };
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith('t='));
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter((value) => /^[a-f0-9]{64}$/i.test(value));

  if (!timestampPart || signatures.length === 0) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isInteger(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = createHmac('sha256', webhookSecret)
    .update(timestamp + '.' + rawBody, 'utf8')
    .digest();

  return signatures.some((signature) => {
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
