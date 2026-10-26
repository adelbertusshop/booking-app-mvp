import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../supabase/migrations/20261025140000_lumar_advertising_order_creation_draft.sql', import.meta.url),
  'utf8',
);

test('order creation draft uses a durable per-user idempotency key and request hash', () => {
  assert.match(migration, /primary key \(advertiser_user_id, idempotency_key\)/i);
  assert.match(migration, /request_hash text not null check \(request_hash ~ '\^\[a-f0-9\]\{64\}\$'\)/i);
  assert.match(migration, /v_existing_hash is distinct from p_request_hash/i);
});

test('order creation RPC explicitly rejects a NULL duration', () => {
  assert.match(migration, /p_duration_days is null or p_duration_days not in \\(7, 30, 90\\)/i);
});

test('campaign and order are created by one database function and transaction', () => {
  assert.match(migration, /create or replace function public\.lumar_create_advertising_order/i);
  assert.match(migration, /insert into public\.ad_campaigns/i);
  assert.match(migration, /insert into public\.ad_orders/i);
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
});

test('order amount and initial state are derived before payment and never activate a campaign', () => {
  assert.match(migration, /p_amount_minor, p_amount_minor, 'PLN', 'pending'/i);
  assert.match(migration, /p_duration_days, 'pending_payment'/i);
  assert.doesNotMatch(migration, /status\s*=\s*'active'/i);
});

test('RPC is denied to client roles and reserved for service role', () => {
  assert.match(migration, /from public, anon, authenticated;/i);
  assert.match(migration, /\) to service_role;/i);
});

test('draft explicitly requires review and does not claim to be applied', () => {
  assert.match(migration, /DRAFT ONLY/i);
  assert.match(migration, /NOT APPLIED/i);
  assert.match(migration, /Keep quote payable=false and Checkout\/webhook disabled/i);
});
