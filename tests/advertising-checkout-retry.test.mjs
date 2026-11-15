import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stripe = await readFile(
  new URL('../lib/advertising/stripe.ts', import.meta.url),
  'utf8',
);
const checkout = await readFile(
  new URL('../app/api/advertising/checkout/route.ts', import.meta.url),
  'utf8',
);

test('Stripe Checkout uses a caller-supplied stable idempotency key', () => {
  assert.match(stripe, /createAdvertisingCheckoutSession\([\s\S]*?idempotencyKey:\s*string/);
  assert.match(stripe, /'Idempotency-Key':\s*idempotencyKey/);
  assert.doesNotMatch(stripe, /'Idempotency-Key':\s*'lumar-advertising-'\s*\+\s*input\.orderId/);
});

test('initial and expired-session retries use distinct deterministic idempotency keys', () => {
  assert.match(stripe, /getAdvertisingCheckoutIdempotencyKey/);
  assert.match(stripe, /-initial/);
  assert.match(stripe, /-retry-/);
  assert.match(checkout, /getAdvertisingCheckoutIdempotencyKey\(order\.order_id\)/);
  assert.match(checkout, /getAdvertisingCheckoutIdempotencyKey\(order\.order_id,\s*previousSession\.id\)/);
});

test('checkout reuses an existing open session rather than creating another one', () => {
  assert.match(checkout, /retrieveAdvertisingCheckoutSession\(previousSessionId\)/);
  assert.match(checkout, /previousSession\.status === 'open' && previousSession\.url/);
  assert.match(checkout, /session = previousSession/);
});

test('checkout renews only expired unpaid sessions belonging to the exact order', () => {
  assert.match(checkout, /previousSession\.status === 'expired' && previousSession\.payment_status === 'unpaid'/);
  assert.match(checkout, /previousSession\.client_reference_id === order\.order_id/);
  assert.match(checkout, /metadata\.order_id === order\.order_id/);
  assert.match(checkout, /metadata\.campaign_id === order\.campaign_id/);
  assert.match(checkout, /previousSession\.amount_total === amountMinor/);
  assert.match(checkout, /previousSession\.livemode === false/);
});

test('checkout refuses to create another session after the order is no longer pending', () => {
  assert.match(checkout, /currentOrder\.status !== 'pending'/);
  assert.match(checkout, /return fail\('To zamówienie nie oczekuje już na płatność\.', 409\)/);
});
