import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const base = await readFile(new URL('../supabase/migrations/20261115161707_lumar_advertising_base.sql', import.meta.url), 'utf8');
const order = await readFile(new URL('../supabase/migrations/20261115161709_lumar_advertising_order_creation.sql', import.meta.url), 'utf8');
const payment = await readFile(new URL('../supabase/migrations/20261115161712_lumar_advertising_atomic_payment.sql', import.meta.url), 'utf8');
const checkout = await readFile(new URL('../app/api/advertising/checkout/route.ts', import.meta.url), 'utf8');
const webhook = await readFile(new URL('../app/api/advertising/webhook/route.ts', import.meta.url), 'utf8');
const auth = await readFile(new URL('../lib/advertising/auth.ts', import.meta.url), 'utf8');

test('production advertising migration sources match applied history and are transactional', () => {
  for (const migration of [base, order, payment]) {
    assert.match(migration, /applied to production on 2026-11-15/i);
    assert.match(migration, /^begin;/m);
    assert.match(migration, /^commit;/m);
  }
});

test('all advertising tables keep RLS enabled and deny direct client table grants', () => {
  for (const table of ['ad_campaigns', 'ad_orders', 'ad_events', 'ad_stripe_webhook_events']) {
    assert.ok(base.includes(`alter table public.${table} enable row level security;`));
  }
  assert.match(base, /revoke all on table public\.ad_campaigns, public\.ad_orders, public\.ad_events,[\s\S]*?from public, anon, authenticated;/i);
  assert.match(base, /grant all on table public\.ad_campaigns, public\.ad_orders, public\.ad_events,[\s\S]*?to service_role;/i);
  assert.match(order, /alter table public\.ad_order_idempotency enable row level security;/i);
  assert.match(order, /revoke all on table public\.ad_order_idempotency from public, anon, authenticated;/i);
  assert.match(order, /grant all on table public\.ad_order_idempotency to service_role;/i);
});

test('privileged RPC functions have a pinned search_path and service-role-only execution', () => {
  for (const [sql, signature] of [
    [order, /lumar_create_advertising_order/],
    [payment, /lumar_apply_advertising_payment_success/],
  ]) {
    assert.match(sql, /security definer[\s\S]*?set search_path = pg_catalog/i);
    assert.match(sql, /from public, anon, authenticated;/i);
    assert.match(sql, /to service_role;/i);
    assert.match(sql, signature);
  }
});

test('order creation is atomic and rejects idempotency-key reuse with a different request', () => {
  assert.match(order, /primary key \(advertiser_user_id, idempotency_key\)/i);
  assert.match(order, /v_existing_hash is distinct from p_request_hash/i);
  assert.match(order, /insert into public\.ad_campaigns/i);
  assert.match(order, /insert into public\.ad_orders/i);
  assert.match(order, /return query select v_existing_campaign, v_existing_order, true/i);
});

test('payment transition verifies exact event, session, amount and mode before moderation', () => {
  assert.match(payment, /v_event\.event_type <> 'checkout\.session\.completed'/i);
  assert.match(payment, /stripe_checkout_session_id is distinct from p_checkout_session_id/i);
  assert.match(payment, /p_amount_total_minor <> v_expected_amount/i);
  assert.match(payment, /p_event_livemode is distinct from p_expected_livemode/i);
  assert.match(payment, /set status = 'pending_review'/i);
  assert.doesNotMatch(payment, /set status = 'active'/i);
});

test('test Checkout and test webhook cannot run on Vercel production', () => {
  assert.match(checkout, /process\.env\.VERCEL_ENV === 'production'/);
  assert.match(webhook, /process\.env\.VERCEL_ENV === 'production'/);
  assert.match(auth, /^import 'server-only';/);
});
